/**
 * Chat storage system for managing conversation threads
 * Uses localStorage for browser persistence
 */

import type { TenantId } from '@/lib/config/tenants';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sources?: string[];
}

export interface ChatThread {
  id: string;
  title: string;
  tenant: TenantId;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface ChatMetadata {
  id: string;
  title: string;
  tenant: TenantId;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

const STORAGE_KEY = 'medical-ai-chats';
const ACTIVE_THREAD_KEY = 'medical-ai-active-thread';

class ChatStorage {
  private threads: Map<string, ChatThread> = new Map();
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.threads = new Map(Object.entries(data));
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to load chat history:', error);
      this.threads = new Map();
    }
  }

  private saveToStorage(): void {
    if (!this.initialized) return;
    
    try {
      const data = Object.fromEntries(this.threads);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }

  /**
   * Generate a unique thread ID
   */
  generateThreadId(): string {
    return `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new chat thread
   */
  createThread(tenant: TenantId, initialMessage?: ChatMessage): ChatThread {
    const threadId = this.generateThreadId();
    const now = Date.now();
    
    const thread: ChatThread = {
      id: threadId,
      title: initialMessage?.content.slice(0, 50) || 'New Chat',
      tenant,
      messages: initialMessage ? [initialMessage] : [],
      createdAt: now,
      updatedAt: now,
      isActive: true
    };

    // Deactivate other threads
    this.threads.forEach(t => t.isActive = false);
    
    this.threads.set(threadId, thread);
    this.saveToStorage();
    this.setActiveThread(threadId);
    
    return thread;
  }

  /**
   * Get a thread by ID
   */
  getThread(threadId: string): ChatThread | null {
    return this.threads.get(threadId) || null;
  }

  /**
   * Get all threads metadata (for sidebar)
   */
  getAllThreadsMetadata(): ChatMetadata[] {
    const metadata: ChatMetadata[] = [];
    
    this.threads.forEach(thread => {
      const lastUserMessage = [...thread.messages]
        .reverse()
        .find(m => m.role === 'user');
      
      metadata.push({
        id: thread.id,
        title: thread.title,
        tenant: thread.tenant,
        messageCount: thread.messages.length,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        preview: lastUserMessage?.content.slice(0, 100) || 'No messages'
      });
    });

    // Sort by most recent first
    return metadata.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get threads for a specific tenant
   */
  getThreadsByTenant(tenant: TenantId): ChatMetadata[] {
    return this.getAllThreadsMetadata().filter(t => t.tenant === tenant);
  }

  /**
   * Add a message to a thread
   */
  addMessage(threadId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage | null {
    const thread = this.threads.get(threadId);
    if (!thread) return null;

    const fullMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    thread.messages.push(fullMessage);
    thread.updatedAt = Date.now();

    // Update title if it's the first user message
    if (thread.messages.length === 1 && message.role === 'user') {
      thread.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
    }

    this.saveToStorage();
    return fullMessage;
  }

  /**
   * Update thread title
   */
  updateThreadTitle(threadId: string, title: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) return false;

    thread.title = title;
    thread.updatedAt = Date.now();
    this.saveToStorage();
    return true;
  }

  /**
   * Delete a thread
   */
  deleteThread(threadId: string): boolean {
    const deleted = this.threads.delete(threadId);
    if (deleted) {
      this.saveToStorage();
      
      // Clear active thread if it was deleted
      const activeId = this.getActiveThreadId();
      if (activeId === threadId) {
        localStorage.removeItem(ACTIVE_THREAD_KEY);
      }
    }
    return deleted;
  }

  /**
   * Clear all threads
   */
  clearAllThreads(): void {
    this.threads.clear();
    this.saveToStorage();
    localStorage.removeItem(ACTIVE_THREAD_KEY);
  }

  /**
   * Clear threads for a specific tenant
   */
  clearTenantThreads(tenant: TenantId): void {
    const toDelete: string[] = [];
    this.threads.forEach((thread, id) => {
      if (thread.tenant === tenant) {
        toDelete.push(id);
      }
    });
    
    toDelete.forEach(id => this.threads.delete(id));
    this.saveToStorage();
  }

  /**
   * Get/Set active thread
   */
  getActiveThreadId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_THREAD_KEY);
  }

  setActiveThread(threadId: string): void {
    if (typeof window === 'undefined') return;
    
    // Deactivate all threads
    this.threads.forEach(t => t.isActive = false);
    
    // Activate selected thread
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.isActive = true;
      localStorage.setItem(ACTIVE_THREAD_KEY, threadId);
      this.saveToStorage();
    }
  }

  /**
   * Get active thread
   */
  getActiveThread(): ChatThread | null {
    const activeId = this.getActiveThreadId();
    if (!activeId) return null;
    return this.getThread(activeId);
  }

  /**
   * Export chat as text
   */
  exportThreadAsText(threadId: string): string {
    const thread = this.threads.get(threadId);
    if (!thread) return '';

    let text = `Chat Export: ${thread.title}\n`;
    text += `Date: ${new Date(thread.createdAt).toLocaleString()}\n`;
    text += `Tenant: ${thread.tenant}\n`;
    text += `${'='.repeat(50)}\n\n`;

    thread.messages.forEach(msg => {
      text += `[${msg.role.toUpperCase()}] ${new Date(msg.timestamp).toLocaleTimeString()}\n`;
      text += `${msg.content}\n`;
      if (msg.sources && msg.sources.length > 0) {
        text += `Sources: ${msg.sources.join(', ')}\n`;
      }
      text += '\n';
    });

    return text;
  }

  /**
   * Import chat from JSON
   */
  importThread(threadData: ChatThread): boolean {
    try {
      // Generate new ID to avoid conflicts
      const newThread = {
        ...threadData,
        id: this.generateThreadId(),
        updatedAt: Date.now()
      };
      
      this.threads.set(newThread.id, newThread);
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Failed to import thread:', error);
      return false;
    }
  }
}

// Export singleton instance
export const chatStorage = new ChatStorage();