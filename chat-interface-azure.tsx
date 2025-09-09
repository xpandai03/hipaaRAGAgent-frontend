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
  Upload,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { TenantSelector, TenantProvider, useTenant } from "@/components/ui/tenant-selector"
import { azureOpenAIClient, type Message as AzureMessage } from "@/lib/api/azure-openai-client"
import { getTenantConfig, RAG_FUNCTION_DEFINITION, type TenantId } from "@/lib/config/tenants"

type ActiveButton = "none" | "add" | "deepSearch" | "think"
type MessageType = "user" | "system" | "function"

interface Message {
  id: string
  content: string
  type: MessageType
  completed?: boolean
  newSection?: boolean
  functionCall?: {
    name: string
    arguments: string
  }
  sources?: string[]
}

interface MessageSection {
  id: string
  messages: Message[]
  isNewSection: boolean
  isActive?: boolean
  sectionIndex: number
}

// RAG Handler for document search
async function handleRAGSearch(query: string, tenant: TenantId): Promise<{ chunks: string[]; sources: string[] }> {
  try {
    const response = await fetch(process.env.NEXT_PUBLIC_N8N_RAG_WEBHOOK_URL || '/api/rag-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        tenant,
        topK: 5
      })
    });

    if (!response.ok) {
      throw new Error(`RAG search failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      chunks: data.chunks || [],
      sources: data.sources || []
    };
  } catch (error) {
    console.error('RAG search error:', error);
    return { chunks: [], sources: [] };
  }
}

function ChatInterfaceContent() {
  const { currentTenant, clearChatHistory } = useTenant();
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
  const conversationHistoryRef = useRef<AzureMessage[]>([])
  const [isSearchingDocuments, setIsSearchingDocuments] = useState(false)

  // Constants for layout calculations
  const HEADER_HEIGHT = 48
  const INPUT_AREA_HEIGHT = 100
  const TOP_PADDING = 48
  const BOTTOM_PADDING = 128
  const ADDITIONAL_OFFSET = 16

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

  // Clear messages when tenant changes
  useEffect(() => {
    handleClearChat();
  }, [currentTenant]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setMessageSections([]);
    conversationHistoryRef.current = [];
    setCompletedMessages(new Set());
    setActiveSectionId(null);
  }, []);

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
    const messageId = Date.now().toString()
    const tenantConfig = getTenantConfig(currentTenant);
    
    // Build conversation history with tenant system prompt
    const conversationMessages: AzureMessage[] = [
      {
        role: 'system',
        content: tenantConfig.systemPrompt
      },
      ...conversationHistoryRef.current,
      {
        role: 'user',
        content: userMessage
      }
    ];

    // Create empty message for streaming
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        content: "",
        type: "system",
      },
    ])

    setTimeout(() => {
      navigator.vibrate(50)
    }, 200)

    let accumulatedContent = "";
    let functionCallData: { name?: string; arguments?: string } = {};

    try {
      await azureOpenAIClient.streamChat(
        {
          messages: conversationMessages,
          temperature: 0.7,
          max_tokens: 1000,
          stream: true,
          functions: activeButton === 'deepSearch' ? [RAG_FUNCTION_DEFINITION] : undefined,
          function_call: activeButton === 'deepSearch' ? 'auto' : undefined,
          tenant: currentTenant
        },
        (content) => {
          // Handle streaming content
          accumulatedContent += content;
          setMessages((prev) =>
            prev.map((msg) => 
              msg.id === messageId 
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        },
        async (name, args) => {
          // Handle function call for RAG
          if (name === 'search_practice_documents') {
            setIsSearchingDocuments(true);
            try {
              const parsedArgs = JSON.parse(args);
              const { chunks, sources } = await handleRAGSearch(parsedArgs.query, currentTenant);
              
              // Add context from documents to the response
              if (chunks.length > 0) {
                const contextMessage = `\n\n**Based on practice documents:**\n${chunks.join('\n\n')}`;
                accumulatedContent += contextMessage;
                
                setMessages((prev) =>
                  prev.map((msg) => 
                    msg.id === messageId 
                      ? { ...msg, content: accumulatedContent, sources }
                      : msg
                  )
                );
              }
            } catch (error) {
              console.error('Function call error:', error);
            } finally {
              setIsSearchingDocuments(false);
            }
          }
        },
        () => {
          // On complete
          setMessages((prev) =>
            prev.map((msg) => 
              msg.id === messageId 
                ? { ...msg, completed: true }
                : msg
            )
          );
          
          // Update conversation history
          conversationHistoryRef.current.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: accumulatedContent }
          );
          
          // Keep only last 10 messages in history to manage tokens
          if (conversationHistoryRef.current.length > 20) {
            conversationHistoryRef.current = conversationHistoryRef.current.slice(-20);
          }
          
          setCompletedMessages((prev) => new Set(prev).add(messageId));
          navigator.vibrate(50);
          setIsStreaming(false);
        },
        (error) => {
          console.error('Streaming error:', error);
          setMessages((prev) =>
            prev.map((msg) => 
              msg.id === messageId 
                ? { ...msg, content: 'Error: Failed to get response from Azure OpenAI. Please check your configuration.', completed: true }
                : msg
            )
          );
          setIsStreaming(false);
        }
      );
    } catch (error) {
      console.error('Azure OpenAI error:', error);
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
      navigator.vibrate(50)

      const userMessage = inputValue.trim()
      const shouldAddNewSection = messages.length > 0

      const newUserMessage = {
        id: `user-${Date.now()}`,
        content: userMessage,
        type: "user" as MessageType,
        newSection: shouldAddNewSection,
      }

      setInputValue("")
      setHasTyped(false)
      setActiveButton("none")

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }

      setMessages((prev) => [...prev, newUserMessage])

      if (!isMobile) {
        focusTextarea()
      } else {
        if (textareaRef.current) {
          textareaRef.current.blur()
        }
      }

      setIsStreaming(true);
      streamAzureResponse(userMessage)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isStreaming && e.key === "Enter" && e.metaKey) {
      e.preventDefault()
      handleSubmit(e)
      return
    }

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
    const tenantConfig = getTenantConfig(currentTenant);

    return (
      <div key={message.id} className={cn("flex flex-col", message.type === "user" ? "items-end" : "items-start")}>
        <div
          className={cn(
            "max-w-[80%] px-4 py-2 rounded-2xl",
            message.type === "user" 
              ? "bg-white border border-gray-200 rounded-br-none" 
              : `text-gray-900`,
            message.type === "system" && !message.content && "min-h-[40px] flex items-center"
          )}
          style={
            message.type === "system" 
              ? { borderLeft: `3px solid ${tenantConfig.branding.theme.primary}` }
              : undefined
          }
        >
          {message.content && (
            <span className={message.type === "system" && !isCompleted ? "animate-fade-in" : ""}>
              {message.content}
            </span>
          )}

          {!message.content && isStreaming && message.id === messages[messages.length - 1]?.id && (
            <span className="text-gray-400 animate-pulse">Thinking...</span>
          )}
        </div>

        {/* Show document sources if available */}
        {message.sources && message.sources.length > 0 && (
          <div className="flex items-center gap-1 px-4 mt-1 text-xs text-gray-500">
            <FileText className="h-3 w-3" />
            <span>Sources: {message.sources.join(', ')}</span>
          </div>
        )}

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

  const tenantConfig = getTenantConfig(currentTenant);

  return (
    <div
      ref={mainContainerRef}
      className="bg-gray-50 flex flex-col overflow-hidden"
      style={{ height: isMobile ? `${viewportHeight}px` : "100svh" }}
    >
      <header className="fixed top-0 left-0 right-0 h-12 flex items-center px-4 z-20 bg-gray-50 border-b border-gray-200">
        <div className="w-full flex items-center justify-between px-2">
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
            <Menu className="h-5 w-5 text-gray-700" />
            <span className="sr-only">Menu</span>
          </Button>

          <div className="flex items-center gap-4">
            <h1 className="text-base font-medium text-gray-800">Medical AI Assistant</h1>
            <TenantSelector 
              value={currentTenant} 
              onValueChange={(value) => {
                // Tenant change is handled by the provider
              }}
              className="w-[200px]"
            />
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-8 w-8"
            onClick={handleClearChat}
          >
            <PenSquare className="h-5 w-5 text-gray-700" />
            <span className="sr-only">New Chat</span>
          </Button>
        </div>
      </header>

      {/* Practice indicator banner */}
      <div 
        className="fixed top-12 left-0 right-0 h-8 flex items-center justify-center z-10"
        style={{ 
          backgroundColor: tenantConfig.branding.theme.secondary,
          borderBottom: `2px solid ${tenantConfig.branding.theme.primary}`
        }}
      >
        <span className="text-sm font-medium" style={{ color: tenantConfig.branding.theme.primary }}>
          {tenantConfig.branding.displayName}
        </span>
      </div>

      <div ref={chatContainerRef} className="flex-grow pb-32 pt-20 px-4 overflow-y-auto">
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
          
          {isSearchingDocuments && (
            <div className="flex items-center gap-2 text-sm text-gray-500 animate-pulse">
              <Search className="h-4 w-4" />
              <span>Searching practice documents...</span>
            </div>
          )}
          
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
                placeholder={isStreaming ? "Waiting for response..." : `Ask ${tenantConfig.name}...`}
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
                    <Upload className={cn("h-4 w-4 text-gray-500", activeButton === "add" && "text-gray-700")} />
                    <span className="sr-only">Upload Document</span>
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
                      Search Docs
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
                      Deep Think
                    </span>
                  </Button>
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  size="icon"
                  className={cn(
                    "rounded-full h-8 w-8 border-0 flex-shrink-0 transition-all duration-200",
                    hasTyped 
                      ? `bg-[${tenantConfig.branding.theme.primary}] scale-110` 
                      : "bg-gray-200",
                  )}
                  style={hasTyped ? { backgroundColor: tenantConfig.branding.theme.primary } : {}}
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
  )
}

export default function AzureChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <TenantProvider onClearChat={handleClearChat}>
      <ChatInterfaceContent />
    </TenantProvider>
  );
}