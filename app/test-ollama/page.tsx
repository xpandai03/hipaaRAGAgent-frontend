'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ollamaClient } from '@/lib/api/ollama-client';

export default function TestOllama() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [health, setHealth] = useState<boolean | null>(null);

  const checkHealth = async () => {
    const isHealthy = await ollamaClient.healthCheck();
    setHealth(isHealthy);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setResponse('');
    
    try {
      const result = await ollamaClient.chat([
        { role: 'user', content: input }
      ]);
      
      setResponse(result.message.content);
      
      // Show timing info
      if (result.total_duration) {
        const seconds = (result.total_duration / 1e9).toFixed(1);
        setResponse(prev => `${prev}\n\n⏱️ Response time: ${seconds}s`);
      }
    } catch (error) {
      setResponse(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const sendStreamMessage = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setStreaming('');
    
    await ollamaClient.streamChat(
      [{ role: 'user', content: input }],
      (content) => {
        setStreaming(prev => prev + content);
      },
      () => {
        setLoading(false);
      },
      (error) => {
        setStreaming(`Error: ${error}`);
        setLoading(false);
      }
    );
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Test Ollama GPT-OSS Connection</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">Connection Status:</span>
          <Button onClick={checkHealth} size="sm">Check Health</Button>
        </div>
        {health !== null && (
          <div className={`text-lg ${health ? 'text-green-600' : 'text-red-600'}`}>
            {health ? '✅ Connected to Ollama' : '❌ Cannot connect to Ollama'}
          </div>
        )}
        <div className="text-sm text-gray-600 mt-2">
          Server: {process.env.NEXT_PUBLIC_API_URL}
          <br />
          Model: {process.env.NEXT_PUBLIC_OLLAMA_MODEL}
        </div>
      </div>

      <div className="space-y-4">
        <Textarea
          placeholder="Enter your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="w-full"
        />
        
        <div className="flex gap-4">
          <Button 
            onClick={sendMessage} 
            disabled={loading || !input.trim()}
            className="flex-1"
          >
            {loading ? 'Processing...' : 'Send (Regular)'}
          </Button>
          
          <Button 
            onClick={sendStreamMessage} 
            disabled={loading || !input.trim()}
            variant="outline"
            className="flex-1"
          >
            {loading ? 'Streaming...' : 'Send (Stream)'}
          </Button>
        </div>

        {response && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">Regular Response:</h3>
            <pre className="whitespace-pre-wrap">{response}</pre>
          </div>
        )}

        {streaming && (
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold mb-2">Streaming Response:</h3>
            <pre className="whitespace-pre-wrap">{streaming}</pre>
          </div>
        )}
      </div>
    </div>
  );
}