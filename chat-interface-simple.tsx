'use client';

import 'ios-vibrator-pro-max';
import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Lightbulb,
  ArrowUp,
  Menu,
  PenSquare,
  RefreshCcw,
  Copy,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ActiveButton = 'none' | 'add' | 'deepSearch' | 'think';
type MessageType = 'user' | 'system';

interface Message {
  id: string;
  content: string;
  type: MessageType;
  completed?: boolean;
  newSection?: boolean;
}

interface MessageSection {
  id: string;
  messages: Message[];
  isNewSection: boolean;
  isActive?: boolean;
  sectionIndex: number;
}

export default function ChatInterfaceSimple() {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [hasTyped, setHasTyped] = useState(false);
  const [activeButton, setActiveButton] = useState<ActiveButton>('none');
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageSections, setMessageSections] = useState<MessageSection[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [completedMessages, setCompletedMessages] = useState<Set<string>>(new Set());
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Constants for layout
  const HEADER_HEIGHT = 48;
  const TOP_PADDING = 48;
  const BOTTOM_PADDING = 128;
  const ADDITIONAL_OFFSET = 16;

  // Check if device is mobile and get viewport height
  useEffect(() => {
    const checkMobileAndViewport = () => {
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isMobileDevice);
      
      const vh = window.innerHeight;
      setViewportHeight(vh);
      
      if (isMobileDevice && mainContainerRef.current) {
        mainContainerRef.current.style.height = `${vh}px`;
      }
    };
    
    checkMobileAndViewport();
    
    if (mainContainerRef.current) {
      mainContainerRef.current.style.height = isMobile ? `${viewportHeight}px` : '100svh';
    }
    
    window.addEventListener('resize', checkMobileAndViewport);
    
    return () => {
      window.removeEventListener('resize', checkMobileAndViewport);
    };
  }, [isMobile, viewportHeight]);

  // Organize messages into sections
  useEffect(() => {
    if (messages.length === 0) {
      setMessageSections([]);
      return;
    }
    
    const sections: MessageSection[] = [];
    let currentSection: MessageSection = {
      id: `section-${Date.now()}-0`,
      messages: [],
      isNewSection: false,
      sectionIndex: 0,
    };
    
    messages.forEach((message) => {
      if (message.newSection) {
        if (currentSection.messages.length > 0) {
          sections.push({
            ...currentSection,
            isActive: false,
          });
        }
        
        const newSectionId = `section-${Date.now()}-${sections.length}`;
        currentSection = {
          id: newSectionId,
          messages: [message],
          isNewSection: true,
          isActive: true,
          sectionIndex: sections.length,
        };
      } else {
        currentSection.messages.push(message);
      }
    });
    
    if (currentSection.messages.length > 0) {
      sections.push(currentSection);
    }
    
    setMessageSections(sections);
  }, [messages]);

  // Focus the textarea on component mount (only on desktop)
  useEffect(() => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  }, [isMobile]);

  const streamResponse = async (userMessage: string) => {
    try {
      const messageId = Date.now().toString();
      setStreamingMessageId(messageId);
      setStreamingContent('');
      
      // Add empty assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          content: '',
          type: 'system',
        },
      ]);
      
      // Add vibration when streaming begins
      setTimeout(() => {
        navigator.vibrate(50);
      }, 200);
      
      // Call the backend API
      const response = await fetch('http://localhost:8000/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          stream: true,
          provider: 'ollama',  // Using Ollama until Azure model is deployed
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'content') {
                  accumulatedContent += data.content;
                  setStreamingContent(accumulatedContent);
                } else if (data.type === 'done') {
                  // Update with complete message
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === messageId
                        ? { ...msg, content: accumulatedContent, completed: true }
                        : msg
                    ),
                  );
                  
                  // Add to completed messages set
                  setCompletedMessages((prev) => new Set(prev).add(messageId));
                  
                  // Add vibration when streaming ends
                  navigator.vibrate(50);
                  
                  // Reset streaming state
                  setStreamingContent('');
                  setStreamingMessageId(null);
                  setIsStreaming(false);
                  return;
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to stream response:', error);
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingMessageId(null);
      
      // Add error message
      const errorId = Date.now().toString();
      setMessages((prev) => [
        ...prev,
        {
          id: errorId,
          content: 'Sorry, I encountered an error. Please make sure the backend is running and try again.',
          type: 'system',
          completed: true,
        },
      ]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    
    if (!isStreaming) {
      setInputValue(newValue);
      
      if (newValue.trim() !== '' && !hasTyped) {
        setHasTyped(true);
      } else if (newValue.trim() === '' && hasTyped) {
        setHasTyped(false);
      }
      
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        const newHeight = Math.max(24, Math.min(textarea.scrollHeight, 160));
        textarea.style.height = `${newHeight}px`;
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isStreaming) {
      // Add vibration when message is submitted
      navigator.vibrate(50);
      
      const userMessage = inputValue.trim();
      
      // Add as a new section if messages already exist
      const shouldAddNewSection = messages.length > 0;
      
      const newUserMessage = {
        id: `user-${Date.now()}`,
        content: userMessage,
        type: 'user' as MessageType,
        newSection: shouldAddNewSection,
      };
      
      // Reset input before starting the AI response
      setInputValue('');
      setHasTyped(false);
      setActiveButton('none');
      
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      // Add the message after resetting input
      setMessages((prev) => [...prev, newUserMessage]);
      
      // Only focus the textarea on desktop, not on mobile
      if (!isMobile && textareaRef.current) {
        textareaRef.current.focus();
      } else if (textareaRef.current) {
        // On mobile, blur the textarea to dismiss the keyboard
        textareaRef.current.blur();
      }
      
      // Start AI response
      setIsStreaming(true);
      streamResponse(userMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Cmd+Enter on both mobile and desktop
    if (!isStreaming && e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }
    
    // Only handle regular Enter key (without Shift) on desktop
    if (!isStreaming && !isMobile && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleButton = (button: ActiveButton) => {
    if (!isStreaming) {
      setActiveButton((prev) => (prev === button ? 'none' : button));
    }
  };

  const renderMessage = (message: Message) => {
    const isCompleted = completedMessages.has(message.id);
    
    return (
      <div key={message.id} className={cn('flex flex-col', message.type === 'user' ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'max-w-[80%] px-4 py-2 rounded-2xl',
            message.type === 'user' ? 'bg-white border border-gray-200 rounded-br-none' : 'text-gray-900',
          )}
        >
          {/* For user messages or completed system messages */}
          {message.content && (
            <span className={message.type === 'system' && !isCompleted ? 'animate-fade-in' : ''}>
              {message.content}
            </span>
          )}
          
          {/* For streaming messages */}
          {message.id === streamingMessageId && (
            <span className="inline">
              {streamingContent}
            </span>
          )}
        </div>
        
        {/* Message actions */}
        {message.type === 'system' && message.completed && (
          <div className="flex items-center gap-2 px-4 mt-1 mb-2">
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCcw className="h-4 w-4" />
            </button>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <Copy className="h-4 w-4" />
            </button>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <Share2 className="h-4 w-4" />
            </button>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const getContentHeight = () => {
    return viewportHeight - TOP_PADDING - BOTTOM_PADDING - ADDITIONAL_OFFSET;
  };

  const shouldApplyHeight = (sectionIndex: number) => {
    return sectionIndex > 0;
  };

  return (
    <div
      ref={mainContainerRef}
      className="bg-gray-50 flex flex-col overflow-hidden"
      style={{ height: isMobile ? `${viewportHeight}px` : '100svh' }}
    >
      <header className="fixed top-0 left-0 right-0 h-12 flex items-center px-4 z-20 bg-gray-50">
        <div className="w-full flex items-center justify-between px-2">
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
            <Menu className="h-5 w-5 text-gray-700" />
            <span className="sr-only">Menu</span>
          </Button>
          
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-base font-medium text-gray-800">HIPAA GPT</h1>
          </div>
          
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
            <PenSquare className="h-5 w-5 text-gray-700" />
            <span className="sr-only">New Chat</span>
          </Button>
        </div>
      </header>
      
      <div ref={chatContainerRef} className="flex-grow pb-32 pt-12 px-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          {messageSections.length === 0 && (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">
                AI-Powered Medical Assistant
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Ask me anything about healthcare, medical conditions, or patient care.
                Powered by your local Ollama instance for privacy.
              </p>
            </div>
          )}
          
          {messageSections.map((section, sectionIndex) => (
            <div
              key={section.id}
            >
              {section.isNewSection && (
                <div
                  style={
                    section.isActive && shouldApplyHeight(section.sectionIndex)
                      ? { height: `${getContentHeight()}px` }
                      : {}
                  }
                  className="pt-4 flex flex-col justify-start"
                >
                  {section.messages.map((message) => renderMessage(message))}
                </div>
              )}
              
              {!section.isNewSection && <div>{section.messages.map((message) => renderMessage(message))}</div>}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-50">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div
            className={cn(
              'relative w-full rounded-3xl border border-gray-200 bg-white p-3 cursor-text',
              isStreaming && 'opacity-80',
            )}
          >
            <div className="pb-9">
              <Textarea
                ref={textareaRef}
                placeholder={isStreaming ? 'Waiting for response...' : 'Ask about patient care, medical conditions, or healthcare'}
                className="min-h-[24px] max-h-[160px] w-full rounded-3xl border-0 bg-transparent text-gray-900 placeholder:text-gray-400 placeholder:text-base focus-visible:ring-0 focus-visible:ring-offset-0 text-base pl-2 pr-4 pt-0 pb-0 resize-none overflow-y-auto leading-tight"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (textareaRef.current) {
                    textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
              />
            </div>
            
            <div className="absolute bottom-3 left-3 right-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={cn(
                      'rounded-full h-8 w-8 flex-shrink-0 border-gray-200 p-0 transition-colors',
                      activeButton === 'add' && 'bg-gray-100 border-gray-300',
                    )}
                    onClick={() => toggleButton('add')}
                    disabled={isStreaming}
                  >
                    <Plus className={cn('h-4 w-4 text-gray-500', activeButton === 'add' && 'text-gray-700')} />
                    <span className="sr-only">Add</span>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'rounded-full h-8 px-3 flex items-center border-gray-200 gap-1.5 transition-colors',
                      activeButton === 'deepSearch' && 'bg-gray-100 border-gray-300',
                    )}
                    onClick={() => toggleButton('deepSearch')}
                    disabled={isStreaming}
                  >
                    <Search className={cn('h-4 w-4 text-gray-500', activeButton === 'deepSearch' && 'text-gray-700')} />
                    <span className={cn('text-gray-900 text-sm', activeButton === 'deepSearch' && 'font-medium')}>
                      Research
                    </span>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'rounded-full h-8 px-3 flex items-center border-gray-200 gap-1.5 transition-colors',
                      activeButton === 'think' && 'bg-gray-100 border-gray-300',
                    )}
                    onClick={() => toggleButton('think')}
                    disabled={isStreaming}
                  >
                    <Lightbulb className={cn('h-4 w-4 text-gray-500', activeButton === 'think' && 'text-gray-700')} />
                    <span className={cn('text-gray-900 text-sm', activeButton === 'think' && 'font-medium')}>
                      Clinical
                    </span>
                  </Button>
                </div>
                
                <Button
                  type="submit"
                  variant="outline"
                  size="icon"
                  className={cn(
                    'rounded-full h-8 w-8 border-0 flex-shrink-0 transition-all duration-200',
                    hasTyped ? 'bg-black scale-110' : 'bg-gray-200',
                  )}
                  disabled={!inputValue.trim() || isStreaming}
                >
                  <ArrowUp className={cn('h-4 w-4 transition-colors', hasTyped ? 'text-white' : 'text-gray-500')} />
                  <span className="sr-only">Submit</span>
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}