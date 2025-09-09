/**
 * Ollama API Client for GPT-OSS
 * Connects to self-hosted Ollama instance
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://34.10.27.89:11434';
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_OLLAMA_MODEL || 'llama3.2:3b-instruct-q4_0';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model?: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.model = DEFAULT_MODEL;
  }

  /**
   * Send a chat completion request to Ollama
   */
  async chat(messages: Message[], options?: {
    temperature?: number;
    stream?: boolean;
  }): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: options?.stream || false,
        options: {
          temperature: options?.temperature || 0.7,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Stream chat completion using Server-Sent Events
   */
  async streamChat(
    messages: Message[],
    onMessage: (content: string) => void,
    onComplete?: () => void,
    onError?: (error: any) => void
  ) {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (onComplete) onComplete();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              onMessage(data.message.content);
            }
            if (data.done) {
              if (onComplete) onComplete();
              return;
            }
          } catch (e) {
            console.error('Error parsing stream data:', e);
          }
        }
      }
    } catch (error) {
      if (onError) onError(error);
      else console.error('Stream error:', error);
    }
  }

  /**
   * List available models
   */
  async listModels() {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Check if Ollama is running
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get or set the current model
   */
  getModel(): string {
    return this.model;
  }

  setModel(model: string) {
    this.model = model;
  }
}

// Export singleton instance
export const ollamaClient = new OllamaClient();