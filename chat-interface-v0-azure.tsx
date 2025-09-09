"use client"

import "ios-vibrator-pro-max"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
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
  Trash2,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
// import { azureOpenAIClient } from "@/lib/api/azure-openai-client"
import { chatStorage, type ChatMetadata } from "@/lib/storage/chat-storage"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ActiveButton = "none" | "add" | "deepSearch" | "think"
type MessageType = "user" | "system"

interface Message {
  id: string
  content: string
  type: MessageType
  completed?: boolean
  newSection?: boolean
}

interface MessageSection {
  id: string
  messages: Message[]
  isNewSection: boolean
  isActive?: boolean
  sectionIndex: number
}

export default function ChatInterfaceV0Azure() {
  const [inputValue, setInputValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const newSectionRef = useRef<HTMLDivElement>(null)
  const [hasTyped, setHasTyped] = useState(false)
  const [activeButton, setActiveButton] = useState<ActiveButton>("none")
  const [isMobile, setIsMobile] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageSections, setMessageSections] = useState<MessageSection[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [completedMessages, setCompletedMessages] = useState<Set<string>>(new Set())
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)
  const shouldFocusAfterStreamingRef = useRef(false)
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const selectionStateRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null })
  
  // Chat history states
  const [showSidebar, setShowSidebar] = useState(false)
  const [savedChats, setSavedChats] = useState<ChatMetadata[]>([])
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const conversationHistoryRef = useRef<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>([])

  // Constants for layout calculations
  const HEADER_HEIGHT = 48
  const INPUT_AREA_HEIGHT = 100
  const TOP_PADDING = 48
  const BOTTOM_PADDING = 128
  const ADDITIONAL_OFFSET = 16

  // Load saved chats on mount
  useEffect(() => {
    loadSavedChats();
    
    // Check for initial message from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const initialMessage = urlParams.get('message');
    
    if (initialMessage) {
      // Start a new chat with the initial message
      createNewChat();
      setInputValue(initialMessage);
      // Clear the URL parameter
      window.history.replaceState({}, '', '/chat');
      // Auto-submit after a brief delay to ensure UI is ready
      setTimeout(() => {
        if (textareaRef.current) {
          const event = new Event('submit', { bubbles: true });
          textareaRef.current.form?.dispatchEvent(event);
        }
      }, 500);
    } else {
      // Create or load thread normally
      const activeThreadId = chatStorage.getActiveThreadId();
      if (activeThreadId) {
        loadThread(activeThreadId);
      } else {
        createNewChat();
      }
    }
  }, []);

  const loadSavedChats = () => {
    const chats = chatStorage.getAllThreadsMetadata();
    setSavedChats(chats);
  };

  const createNewChat = () => {
    const thread = chatStorage.createThread('amanda');
    setCurrentThreadId(thread.id);
    setMessages([]);
    setMessageSections([]);
    conversationHistoryRef.current = [];
    setCompletedMessages(new Set());
    setActiveSectionId(null);
    loadSavedChats();
  };

  const loadThread = (threadId: string) => {
    const thread = chatStorage.getThread(threadId);
    if (!thread) return;

    setCurrentThreadId(threadId);
    chatStorage.setActiveThread(threadId);
    
    // Convert stored messages to UI messages
    const uiMessages: Message[] = thread.messages.map((msg, index) => ({
      id: msg.id,
      content: msg.content,
      type: msg.role === 'user' ? 'user' : 'system',
      completed: true,
      newSection: index === 0 || (index > 0 && thread.messages[index - 1].role !== msg.role)
    }));
    
    setMessages(uiMessages);
    setCompletedMessages(new Set(uiMessages.map(m => m.id)));
    
    // Rebuild conversation history
    conversationHistoryRef.current = thread.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
  };

  const handleDeleteChat = (chatId: string) => {
    chatStorage.deleteThread(chatId);
    if (chatId === currentThreadId) {
      createNewChat();
    }
    loadSavedChats();
    setDeleteConfirmId(null);
  };

  // Check if device is mobile and get viewport height
  useEffect(() => {
    const checkMobileAndViewport = () => {
      const isMobileDevice = window.innerWidth < 768
      setIsMobile(isMobileDevice)

      const vh = window.innerHeight
      setViewportHeight(vh)

      if (isMobileDevice && mainContainerRef.current) {
        mainContainerRef.current.style.height = `${vh}px`
      }
    }

    checkMobileAndViewport()

    if (mainContainerRef.current) {
      mainContainerRef.current.style.height = isMobile ? `${viewportHeight}px` : "100svh"
    }

    window.addEventListener("resize", checkMobileAndViewport)

    return () => {
      window.removeEventListener("resize", checkMobileAndViewport)
    }
  }, [isMobile, viewportHeight])

  // Organize messages into sections
  useEffect(() => {
    if (messages.length === 0) {
      setMessageSections([])
      setActiveSectionId(null)
      return
    }

    const sections: MessageSection[] = []
    let currentSection: MessageSection = {
      id: `section-${Date.now()}-0`,
      messages: [],
      isNewSection: false,
      sectionIndex: 0,
    }

    messages.forEach((message) => {
      if (message.newSection) {
        if (currentSection.messages.length > 0) {
          sections.push({
            ...currentSection,
            isActive: false,
          })
        }

        const newSectionId = `section-${Date.now()}-${sections.length}`
        currentSection = {
          id: newSectionId,
          messages: [message],
          isNewSection: true,
          isActive: true,
          sectionIndex: sections.length,
        }

        setActiveSectionId(newSectionId)
      } else {
        currentSection.messages.push(message)
      }
    })

    if (currentSection.messages.length > 0) {
      sections.push(currentSection)
    }

    setMessageSections(sections)
  }, [messages])

  // Scroll to maximum position when new section is created
  useEffect(() => {
    if (messageSections.length > 1) {
      setTimeout(() => {
        const scrollContainer = chatContainerRef.current

        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: "smooth",
          })
        }
      }, 100)
    }
  }, [messageSections])

  // Focus the textarea on component mount (only on desktop)
  useEffect(() => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus()
    }
  }, [isMobile])

  // Set focus back to textarea after streaming ends
  useEffect(() => {
    if (!isStreaming && shouldFocusAfterStreamingRef.current && !isMobile) {
      focusTextarea()
      shouldFocusAfterStreamingRef.current = false
    }
  }, [isStreaming, isMobile])

  const getContentHeight = () => {
    return viewportHeight - TOP_PADDING - BOTTOM_PADDING - ADDITIONAL_OFFSET
  }

  const saveSelectionState = () => {
    if (textareaRef.current) {
      selectionStateRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      }
    }
  }

  const restoreSelectionState = () => {
    const textarea = textareaRef.current
    const { start, end } = selectionStateRef.current

    if (textarea && start !== null && end !== null) {
      textarea.focus()
      textarea.setSelectionRange(start, end)
    } else if (textarea) {
      textarea.focus()
    }
  }

  const focusTextarea = () => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus()
    }
  }

  const handleInputContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target === e.currentTarget ||
      (e.currentTarget === inputContainerRef.current && !(e.target as HTMLElement).closest("button"))
    ) {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }

  const streamAzureResponse = async (userMessage: string) => {
    // Create a new message with empty content
    const messageId = Date.now().toString()
    
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        content: "",
        type: "system",
      },
    ])

    // Add vibration when streaming begins
    setTimeout(() => {
      navigator.vibrate(50)
    }, 200)

    let accumulatedContent = "";

    try {
      // Build conversation history - Always include a system message for GPT-5-mini
      const systemMessage = activeButton === 'think' 
        ? 'You are HIPAA GPT, a thoughtful medical AI assistant. Think deeply and provide comprehensive, well-reasoned responses.'
        : activeButton === 'deepSearch'
        ? 'You are HIPAA GPT, a medical AI assistant. Search your knowledge deeply for relevant medical information and provide detailed, evidence-based responses.'
        : 'You are HIPAA GPT, a helpful medical AI assistant. Provide clear, accurate, and professional responses.';
      
      const messages = [
        { role: 'system', content: systemMessage },
        ...conversationHistoryRef.current.filter(msg => msg.role !== 'system'), // Remove any old system messages
        { role: 'user', content: userMessage }
      ];

      // Call API route - use FastAPI endpoint for RAG
      const endpoint = '/api/chat/fastapi';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          temperature: 1, // GPT-5-mini only supports temperature=1
          max_tokens: activeButton === 'think' || activeButton === 'deepSearch' ? 2000 : 1000,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('API request failed:', error);
        throw new Error('API request failed');
      }

      // Check if response is streaming or JSON
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        // Non-streaming response
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response';
        accumulatedContent = content;
        
        setMessages((prev) =>
          prev.map((msg) => 
            msg.id === messageId 
              ? { ...msg, content: accumulatedContent }
              : msg
          )
        );
      } else {
        // Streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line === 'data: [DONE]') {
              // Update message as completed
              setMessages((prev) =>
                prev.map((msg) => 
                  msg.id === messageId 
                    ? { ...msg, completed: true }
                    : msg
                )
              );

              // Add to completed messages set
              setCompletedMessages((prev) => new Set(prev).add(messageId));

              // Update conversation history
              conversationHistoryRef.current.push(
                { role: 'user', content: userMessage },
                { role: 'assistant', content: accumulatedContent }
              );

              // Keep only last 10 messages in history
              if (conversationHistoryRef.current.length > 20) {
                conversationHistoryRef.current = conversationHistoryRef.current.slice(-20);
              }

              // Save to storage
              if (currentThreadId) {
                chatStorage.addMessage(currentThreadId, {
                  role: 'assistant',
                  content: accumulatedContent
                });
                loadSavedChats();
              }

              // Add vibration when streaming ends
              navigator.vibrate(50);

              // Reset streaming state
              setIsStreaming(false);
              break;
            }

            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                // Handle Azure OpenAI streaming format
                if (data.choices && data.choices[0]) {
                  const delta = data.choices[0].delta;
                  if (delta && delta.content) {
                    accumulatedContent += delta.content;
                    setMessages((prev) =>
                      prev.map((msg) => 
                        msg.id === messageId 
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  }
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('API error:', error);
      setMessages((prev) =>
        prev.map((msg) => 
          msg.id === messageId 
            ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', completed: true }
            : msg
        )
      );
      setIsStreaming(false);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value

    if (!isStreaming) {
      setInputValue(newValue)

      if (newValue.trim() !== "" && !hasTyped) {
        setHasTyped(true)
      } else if (newValue.trim() === "" && hasTyped) {
        setHasTyped(false)
      }

      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = "auto"
        const newHeight = Math.max(24, Math.min(textarea.scrollHeight, 160))
        textarea.style.height = `${newHeight}px`
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && !isStreaming) {
      // Add vibration when message is submitted
      navigator.vibrate(50)

      const userMessage = inputValue.trim()

      // Add as a new section if messages already exist
      const shouldAddNewSection = messages.length > 0

      const newUserMessage = {
        id: `user-${Date.now()}`,
        content: userMessage,
        type: "user" as MessageType,
        newSection: shouldAddNewSection,
      }

      // Save user message to storage
      if (currentThreadId) {
        chatStorage.addMessage(currentThreadId, {
          role: 'user',
          content: userMessage
        });
      }

      // Reset input before starting the AI response
      setInputValue("")
      setHasTyped(false)
      setActiveButton("none")

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }

      // Add the message after resetting input
      setMessages((prev) => [...prev, newUserMessage])

      // Only focus the textarea on desktop, not on mobile
      if (!isMobile) {
        focusTextarea()
      } else {
        // On mobile, blur the textarea to dismiss the keyboard
        if (textareaRef.current) {
          textareaRef.current.blur()
        }
      }

      // Start AI response
      setIsStreaming(true);
      streamAzureResponse(userMessage)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Cmd+Enter on both mobile and desktop
    if (!isStreaming && e.key === "Enter" && e.metaKey) {
      e.preventDefault()
      handleSubmit(e)
      return
    }

    // Only handle regular Enter key (without Shift) on desktop
    if (!isStreaming && !isMobile && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const toggleButton = (button: ActiveButton) => {
    if (!isStreaming) {
      saveSelectionState()
      setActiveButton((prev) => (prev === button ? "none" : button))
      setTimeout(() => {
        restoreSelectionState()
      }, 0)
    }
  }

  const renderMessage = (message: Message) => {
    const isCompleted = completedMessages.has(message.id)

    return (
      <div key={message.id} className={cn("flex flex-col", message.type === "user" ? "items-end" : "items-start")}>
        <div
          className={cn(
            "max-w-[80%] px-4 py-2 rounded-2xl",
            message.type === "user" ? "bg-white border border-gray-200 rounded-br-none" : "text-gray-900",
          )}
        >
          {/* For user messages or completed system messages, render without animation */}
          {message.content && (
            <span className={message.type === "system" && !isCompleted ? "animate-fade-in" : ""}>
              {message.content}
            </span>
          )}
        </div>

        {/* Message actions */}
        {message.type === "system" && message.completed && (
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
    )
  }

  const shouldApplyHeight = (sectionIndex: number) => {
    return sectionIndex > 0
  }

  const formatChatTitle = (chat: ChatMetadata) => {
    if (chat.title.length > 30) {
      return chat.title.substring(0, 30) + '...';
    }
    return chat.title;
  };

  return (
    <div
      ref={mainContainerRef}
      className="bg-gray-50 flex overflow-hidden"
      style={{ height: isMobile ? `${viewportHeight}px` : "100svh" }}
    >
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="fixed top-0 left-0 right-0 h-12 flex items-center px-4 z-20 bg-gray-50">
          <div className="w-full flex items-center justify-between px-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full h-8 w-8"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <Menu className="h-5 w-5 text-gray-700" />
              <span className="sr-only">Menu</span>
            </Button>

            <h1 className="text-base font-medium text-gray-800">HIPAA GPT</h1>

            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full h-8 w-8"
              onClick={createNewChat}
            >
              <PenSquare className="h-5 w-5 text-gray-700" />
              <span className="sr-only">New Chat</span>
            </Button>
          </div>
        </header>

        <div ref={chatContainerRef} className="flex-grow pb-32 pt-12 px-4 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-4">
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
                "relative w-full rounded-3xl border border-gray-200 bg-white p-3 cursor-text",
                isStreaming && "opacity-80",
              )}
              onClick={handleInputContainerClick}
            >
              <div className="pb-9">
                <Textarea
                  ref={textareaRef}
                  placeholder={isStreaming ? "Waiting for response..." : "Ask Anything"}
                  className="min-h-[24px] max-h-[160px] w-full rounded-3xl border-0 bg-transparent text-gray-900 placeholder:text-gray-400 placeholder:text-base focus-visible:ring-0 focus-visible:ring-offset-0 text-base pl-2 pr-4 pt-0 pb-0 resize-none overflow-y-auto leading-tight"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (textareaRef.current) {
                      textareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
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
                        "rounded-full h-8 w-8 flex-shrink-0 border-gray-200 p-0 transition-colors",
                        activeButton === "add" && "bg-gray-100 border-gray-300",
                      )}
                      onClick={() => toggleButton("add")}
                      disabled={isStreaming}
                    >
                      <Plus className={cn("h-4 w-4 text-gray-500", activeButton === "add" && "text-gray-700")} />
                      <span className="sr-only">Add</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "rounded-full h-8 px-3 flex items-center border-gray-200 gap-1.5 transition-colors",
                        activeButton === "deepSearch" && "bg-gray-100 border-gray-300",
                      )}
                      onClick={() => toggleButton("deepSearch")}
                      disabled={isStreaming}
                    >
                      <Search className={cn("h-4 w-4 text-gray-500", activeButton === "deepSearch" && "text-gray-700")} />
                      <span className={cn("text-gray-900 text-sm", activeButton === "deepSearch" && "font-medium")}>
                        DeepSearch
                      </span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "rounded-full h-8 px-3 flex items-center border-gray-200 gap-1.5 transition-colors",
                        activeButton === "think" && "bg-gray-100 border-gray-300",
                      )}
                      onClick={() => toggleButton("think")}
                      disabled={isStreaming}
                    >
                      <Lightbulb className={cn("h-4 w-4 text-gray-500", activeButton === "think" && "text-gray-700")} />
                      <span className={cn("text-gray-900 text-sm", activeButton === "think" && "font-medium")}>
                        Think
                      </span>
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    variant="outline"
                    size="icon"
                    className={cn(
                      "rounded-full h-8 w-8 border-0 flex-shrink-0 transition-all duration-200",
                      hasTyped ? "bg-black scale-110" : "bg-gray-200",
                    )}
                    disabled={!inputValue.trim() || isStreaming}
                  >
                    <ArrowUp className={cn("h-4 w-4 transition-colors", hasTyped ? "text-white" : "text-gray-500")} />
                    <span className="sr-only">Submit</span>
                  </Button>
                </div>
              </div>
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
  )
}