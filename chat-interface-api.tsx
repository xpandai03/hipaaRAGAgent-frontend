'use client';

import 'ios-vibrator-pro-max';
import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Upload,
  FileText,
  LogOut,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import Cookies from 'js-cookie';

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

export default function ChatInterfaceAPI() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const newSectionRef = useRef<HTMLDivElement>(null);
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
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const shouldFocusAfterStreamingRef = useRef(false);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const selectionStateRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Constants for layout calculations
  const HEADER_HEIGHT = 48;
  const INPUT_AREA_HEIGHT = 100;
  const TOP_PADDING = 48;
  const BOTTOM_PADDING = 128;
  const ADDITIONAL_OFFSET = 16;

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = Cookies.get('access_token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      try {
        const userData = await apiClient.getMe();
        setUser(userData);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
      }
    };
    
    checkAuth();
  }, [router]);

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
      setActiveSectionId(null);
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
        
        setActiveSectionId(newSectionId);
      } else {
        currentSection.messages.push(message);
      }
    });
    
    if (currentSection.messages.length > 0) {
      sections.push(currentSection);
    }
    
    setMessageSections(sections);
  }, [messages]);

  // Scroll to maximum position when new section is created
  useEffect(() => {
    if (messageSections.length > 1) {
      setTimeout(() => {
        const scrollContainer = chatContainerRef.current;
        
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 100);
    }
  }, [messageSections]);

  // Focus the textarea on component mount (only on desktop)
  useEffect(() => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  }, [isMobile]);

  // Set focus back to textarea after streaming ends (only on desktop)
  useEffect(() => {
    if (!isStreaming && shouldFocusAfterStreamingRef.current && !isMobile) {
      focusTextarea();
      shouldFocusAfterStreamingRef.current = false;
    }
  }, [isStreaming, isMobile]);

  const getContentHeight = () => {
    return viewportHeight - TOP_PADDING - BOTTOM_PADDING - ADDITIONAL_OFFSET;
  };

  const saveSelectionState = () => {
    if (textareaRef.current) {
      selectionStateRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
  };

  const restoreSelectionState = () => {
    const textarea = textareaRef.current;
    const { start, end } = selectionStateRef.current;
    
    if (textarea && start !== null && end !== null) {
      textarea.focus();
      textarea.setSelectionRange(start, end);
    } else if (textarea) {
      textarea.focus();
    }
  };

  const focusTextarea = () => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  };

  const handleInputContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target === e.currentTarget ||
      (e.currentTarget === inputContainerRef.current && !(e.target as HTMLElement).closest('button'))
    ) {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const streamAIResponse = async (userMessage: string) => {
    try {
      // Create conversation if doesn't exist
      if (!currentConversationId) {
        const conversation = await apiClient.createConversation();
        setCurrentConversationId(conversation.id);
      }
      
      const conversationId = currentConversationId || (await apiClient.createConversation()).id;
      
      // Create a new message with empty content
      const messageId = Date.now().toString();
      setStreamingMessageId(messageId);
      setStreamingContent('');
      
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
      
      // Create EventSource for streaming
      const eventSource = apiClient.streamChat(conversationId, userMessage);
      eventSourceRef.current = eventSource;
      
      let accumulatedContent = '';
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'token') {
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
          
          // Close EventSource
          eventSource.close();
          eventSourceRef.current = null;
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('Stream error:', error);
        
        // Update message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { 
                  ...msg, 
                  content: 'Sorry, an error occurred while processing your request.', 
                  completed: true 
                }
              : msg
          ),
        );
        
        setStreamingContent('');
        setStreamingMessageId(null);
        setIsStreaming(false);
        
        eventSource.close();
        eventSourceRef.current = null;
      };
    } catch (error) {
      console.error('Failed to stream response:', error);
      setIsStreaming(false);
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
      if (!isMobile) {
        focusTextarea();
      } else {
        // On mobile, blur the textarea to dismiss the keyboard
        if (textareaRef.current) {
          textareaRef.current.blur();
        }
      }
      
      // Start AI response
      setIsStreaming(true);
      streamAIResponse(userMessage);
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
      saveSelectionState();
      setActiveButton((prev) => (prev === button ? 'none' : button));
      setTimeout(() => {
        restoreSelectionState();
      }, 0);
    }
  };

  const handleNewChat = async () => {
    // Clear current conversation
    setCurrentConversationId(null);
    setMessages([]);
    setMessageSections([]);
    setStreamingContent('');
    setStreamingMessageId(null);
    setCompletedMessages(new Set());
    
    // Close any active streams
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logoutUser();
    } finally {
      router.push('/login');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const result = await apiClient.uploadDocument(file);
      console.log('Document uploaded:', result);
      setShowDocUpload(false);
      // You could add a toast notification here
    } catch (error) {
      console.error('Upload failed:', error);
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
          {/* For user messages or completed system messages, render without animation */}
          {message.content && (
            <span className={message.type === 'system' && !isCompleted ? 'animate-fade-in' : ''}>
              {message.content}
            </span>
          )}
          
          {/* For streaming messages, render the streaming content */}
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
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={handleLogout}>
            <LogOut className="h-5 w-5 text-gray-700" />
            <span className="sr-only">Logout</span>
          </Button>
          
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-base font-medium text-gray-800">HIPAA GPT</h1>
          </div>
          
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={handleNewChat}>
            <PenSquare className="h-5 w-5 text-gray-700" />
            <span className="sr-only">New Chat</span>
          </Button>
        </div>
      </header>
      
      {user && (
        <div className="fixed top-12 left-0 right-0 h-8 flex items-center px-6 bg-gray-50 text-xs text-gray-600 border-b border-gray-200">
          <span>Organization: {user.organization.name}</span>
          <span className="mx-2">•</span>
          <span>{user.full_name}</span>
        </div>
      )}
      
      <div ref={chatContainerRef} className="flex-grow pb-32 pt-20 px-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          {messageSections.length === 0 && (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">
                HIPAA-Compliant AI Assistant
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Your conversations and documents are encrypted and secured. 
                All PHI is handled in compliance with HIPAA regulations.
              </p>
            </div>
          )}
          
          {messageSections.map((section, sectionIndex) => (
            <div
              key={section.id}
              ref={sectionIndex === messageSections.length - 1 && section.isNewSection ? newSectionRef : null}
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
            ref={inputContainerRef}
            className={cn(
              'relative w-full rounded-3xl border border-gray-200 bg-white p-3 cursor-text',
              isStreaming && 'opacity-80',
            )}
            onClick={handleInputContainerClick}
          >
            <div className="pb-9">
              <Textarea
                ref={textareaRef}
                placeholder={isStreaming ? 'Waiting for response...' : 'Ask about patient care, documentation, or upload files'}
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
                  <label htmlFor="file-upload">
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={cn(
                        'rounded-full h-8 w-8 flex-shrink-0 border-gray-200 p-0 transition-colors',
                        showDocUpload && 'bg-gray-100 border-gray-300',
                      )}
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={isStreaming}
                    >
                      <Upload className={cn('h-4 w-4 text-gray-500', showDocUpload && 'text-gray-700')} />
                      <span className="sr-only">Upload Document</span>
                    </Button>
                  </label>
                  
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
                    <FileText className={cn('h-4 w-4 text-gray-500', activeButton === 'deepSearch' && 'text-gray-700')} />
                    <span className={cn('text-gray-900 text-sm', activeButton === 'deepSearch' && 'font-medium')}>
                      Documents
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