'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Menu, Plus, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { azureOpenAIClient } from '@/lib/api/azure-openai-client';
import { chatStorage, type ChatThread, type ChatMetadata } from '@/lib/storage/chat-storage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export default function SimplifiedChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [savedChats, setSavedChats] = useState<ChatMetadata[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved chats on mount
  useEffect(() => {
    loadSavedChats();
    // Create new thread on mount if none exists
    const activeThreadId = chatStorage.getActiveThreadId();
    if (activeThreadId) {
      loadThread(activeThreadId);
    } else {
      createNewChat();
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSavedChats = () => {
    const chats = chatStorage.getAllThreadsMetadata();
    setSavedChats(chats);
  };

  const createNewChat = () => {
    const thread = chatStorage.createThread('amanda');
    setCurrentThreadId(thread.id);
    setMessages([]);
    loadSavedChats();
  };

  const loadThread = (threadId: string) => {
    const thread = chatStorage.getThread(threadId);
    if (!thread) return;

    setCurrentThreadId(threadId);
    chatStorage.setActiveThread(threadId);
    
    // Convert stored messages to UI messages
    const uiMessages: Message[] = thread.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }));
    
    setMessages(uiMessages);
  };

  const handleDeleteChat = (chatId: string) => {
    chatStorage.deleteThread(chatId);
    if (chatId === currentThreadId) {
      createNewChat();
    }
    loadSavedChats();
    setDeleteConfirmId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);

    // Save user message to storage
    if (currentThreadId) {
      chatStorage.addMessage(currentThreadId, {
        role: 'user',
        content: userMessage.content
      });
    }

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Prepare conversation history
      const conversationHistory = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      }));

      conversationHistory.push({
        role: 'user',
        content: userMessage.content
      });

      let accumulatedContent = '';

      // Stream response from Azure OpenAI
      await azureOpenAIClient.streamChat(
        {
          messages: [
            {
              role: 'system',
              content: 'You are HIPAA GPT, a helpful medical AI assistant. Be concise and professional.'
            },
            ...conversationHistory
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        (content) => {
          accumulatedContent += content;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        },
        undefined,
        () => {
          // On complete
          if (currentThreadId) {
            chatStorage.addMessage(currentThreadId, {
              role: 'assistant',
              content: accumulatedContent
            });
          }
          loadSavedChats();
          setIsStreaming(false);
        },
        (error) => {
          console.error('Streaming error:', error);
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: 'Sorry, I encountered an error. Please make sure the backend is running and try again.' }
                : msg
            )
          );
          setIsStreaming(false);
        }
      );
    } catch (error) {
      console.error('Error:', error);
      setIsStreaming(false);
    }
  };

  const formatChatTitle = (chat: ChatMetadata) => {
    if (chat.title.length > 30) {
      return chat.title.substring(0, 30) + '...';
    }
    return chat.title;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Chat History</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(false)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
            <Button
              onClick={createNewChat}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2">
              {savedChats.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No saved chats</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {savedChats.map(chat => (
                    <div
                      key={chat.id}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer hover:bg-gray-100 group",
                        currentThreadId === chat.id && "bg-gray-100"
                      )}
                      onClick={() => loadThread(chat.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {formatChatTitle(chat)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(chat.updatedAt)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(chat.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!showSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSidebar(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <h1 className="text-xl font-semibold">HIPAA GPT</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={createNewChat}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg">Start a new conversation</p>
                <p className="text-sm mt-2">Type a message below to begin</p>
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-4 py-2",
                      message.role === 'user'
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 min-h-[60px] max-h-[200px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                disabled={isStreaming}
              />
              <Button
                type="submit"
                disabled={!inputValue.trim() || isStreaming}
                className="px-6"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteChat(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}