/**
 * GPT-OSS API Client with Multi-Tenant Support
 * Connects to self-hosted Ollama instance with tenant routing
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT || 'default';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  top_k?: number;
}

export interface TenantInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export const AVAILABLE_TENANTS: TenantInfo[] = [
  {
    id: 'amanda',
    name: 'Amanda',
    description: 'Mental Health Practice',
    icon: '🧠'
  },
  {
    id: 'robbie',
    name: 'Robbie',
    description: 'Med Spa',
    icon: '💆'
  },
  {
    id: 'emmer',
    name: 'Dr. Emmer',
    description: 'Dermatology',
    icon: '🩺'
  }
];

class GptOssClient {
  private client: AxiosInstance;
  private currentTenant: string;

  constructor() {
    this.currentTenant = DEFAULT_TENANT;
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Set the current tenant for all API calls
   */
  setTenant(tenantId: string) {
    this.currentTenant = tenantId;
  }

  /**
   * Get current tenant
   */
  getCurrentTenant(): string {
    return this.currentTenant;
  }

  /**
   * Send a chat completion request
   */
  async chatCompletion(request: ChatCompletionRequest) {
    const response = await this.client.post('/v1/chat/completions', request, {
      headers: {
        'X-Tenant-ID': this.currentTenant,
      },
    });
    return response.data;
  }

  /**
   * Stream chat completion using Server-Sent Events
   */
  streamChatCompletion(
    request: ChatCompletionRequest,
    onMessage: (content: string) => void,
    onComplete?: () => void,
    onError?: (error: any) => void
  ) {
    const eventSource = new EventSource(
      `${API_BASE_URL}/v1/chat/completions?` +
      new URLSearchParams({
        tenant: this.currentTenant,
        stream: 'true'
      })
    );

    // Send the request body via POST
    fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': this.currentTenant,
      },
      body: JSON.stringify({ ...request, stream: true }),
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.body;
    }).then(body => {
      if (!body) return;
      
      const reader = body.getReader();
      const decoder = new TextDecoder();

      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (onComplete) onComplete();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  if (onComplete) onComplete();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    onMessage(content);
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        } catch (error) {
          if (onError) onError(error);
        }
      };

      readStream();
    }).catch(error => {
      if (onError) onError(error);
    });

    return eventSource;
  }

  /**
   * Get available models for the current tenant
   */
  async getModels() {
    const response = await this.client.get('/v1/models', {
      headers: {
        'X-Tenant-ID': this.currentTenant,
      },
    });
    return response.data;
  }

  /**
   * Health check
   */
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }

  /**
   * Get tenant information
   */
  async getTenantInfo() {
    const response = await this.client.get('/tenants');
    return response.data;
  }
}

// Export singleton instance
export const gptOssClient = new GptOssClient();

// Export types
export type { GptOssClient };