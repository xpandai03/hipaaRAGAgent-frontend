/**
 * Azure OpenAI API Client
 * Connects to Azure OpenAI for HIPAA-compliant chat completions
 */

import OpenAI from 'openai';

// Environment configuration
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://adavi-mf694jmx-eastus2.cognitiveservices.azure.com';
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || 'YOUR_AZURE_API_KEY_HERE';
const DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5-mini';
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';

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
  private client: OpenAI | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      // Configure OpenAI client for Azure
      this.client = new OpenAI({
        apiKey: AZURE_API_KEY,
        baseURL: `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}`,
        defaultQuery: { 'api-version': API_VERSION },
        defaultHeaders: {
          'api-key': AZURE_API_KEY,
        },
        dangerouslyAllowBrowser: true // Allow browser usage for development
      });
    } catch (error) {
      console.error('Failed to initialize Azure OpenAI client:', error);
    }
  }

  /**
   * Stream chat completion
   */
  async streamChat(
    request: ChatRequest,
    onContent: (content: string) => void,
    onComplete?: () => void,
    onError?: (error: any) => void
  ) {
    if (!this.client) {
      const error = new Error('Azure OpenAI client not initialized.');
      if (onError) onError(error);
      else throw error;
      return;
    }

    try {
      const stream = await this.client.chat.completions.create({
        messages: request.messages,
        model: DEPLOYMENT_NAME,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onContent(content);
        }
        
        if (chunk.choices[0]?.finish_reason === 'stop') {
          if (onComplete) onComplete();
        }
      }
      
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Azure OpenAI stream error:', error);
      if (onError) onError(error);
    }
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.client !== null;
  }
}

// Export singleton instance
export const azureOpenAIClient = new AzureOpenAIClient();