/**
 * Azure OpenAI API Client
 * Connects to Azure OpenAI through Next.js API routes for HIPAA-compliant chat completions
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

class AzureOpenAIClient {
  /**
   * Stream chat completion through API route
   */
  async streamChat(
    request: ChatRequest,
    onContent: (content: string) => void,
    onComplete?: () => void,
    onError?: (error: any) => void
  ) {
    try {
      const response = await fetch('/api/chat/azure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              if (onComplete) onComplete();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onContent(parsed.content);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e);
            }
          }
        }
      }

      if (onComplete) onComplete();
    } catch (error) {
      console.error('Azure OpenAI stream error:', error);
      if (onError) onError(error);
    }
  }

  /**
   * Send non-streaming chat request through API route
   */
  async chat(request: ChatRequest): Promise<any> {
    try {
      const response = await fetch('/api/chat/azure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Azure OpenAI chat error:', error);
      throw error;
    }
  }

  /**
   * Check if client is ready (API routes are available)
   */
  isReady(): boolean {
    return true; // API routes should always be available
  }
}

// Export singleton instance
export const azureOpenAIClient = new AzureOpenAIClient();