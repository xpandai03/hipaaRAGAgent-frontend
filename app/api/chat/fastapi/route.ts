import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId, createUser } from '@/lib/db/user';
import { getActiveThread, createThread, addMessage } from '@/lib/db/chat';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await currentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get or create user in database
    let dbUser = await getUserByClerkId(user.id);
    if (!dbUser) {
      dbUser = await createUser(
        user.id,
        user.emailAddresses?.[0]?.emailAddress || '',
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined
      );
    }

    const body = await request.json();
    const { messages, temperature = 0.7, max_tokens = 1000, threadId, tenant = 'amanda' } = body;

    // Handle thread management
    let thread;
    if (threadId) {
      thread = await getActiveThread(dbUser.id);
    }
    
    if (!thread) {
      // Create new thread if none exists
      thread = await createThread(
        dbUser.id, 
        messages[messages.length - 1]?.content?.substring(0, 50) + '...' || 'New Chat',
        tenant
      );
    }

    // Save user message to database
    const userMessage = messages[messages.length - 1];
    if (userMessage && userMessage.role === 'user') {
      await addMessage(thread.id, 'user', userMessage.content);
    }

    console.log('=== FASTAPI RAG CHAT REQUEST ===');
    console.log('User:', dbUser.email);
    console.log('Thread:', thread.id);
    console.log('Query:', userMessage?.content);
    console.log('Temperature:', temperature);
    console.log('Max tokens:', max_tokens);

    try {
      // Call FastAPI RAG service
      const response = await fetch(`${FASTAPI_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage?.content || '',
          session_id: thread.id,
          max_tokens: max_tokens,
          temperature: temperature,
          top_k: dbUser.settings?.enableRAG ? 5 : 0,
          stream: true,
          system_prompt: dbUser.systemPrompt || undefined
        }),
      });

      console.log(`FastAPI response status: ${response.status}`);

      if (!response.ok) {
        // Check if FastAPI is down
        if (!response.ok && response.status === 0) {
          console.error('FastAPI service is unavailable');
          
          // Fallback to direct Azure OpenAI without RAG
          const AZURE_ENDPOINT = 'https://adavi-mf694jmx-eastus2.cognitiveservices.azure.com';
          const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || 'your_azure_openai_api_key_here';
          const DEPLOYMENT_NAME = 'gpt-5-mini';
          const API_VERSION = '2024-08-01-preview';

          const url = `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=${API_VERSION}`;
          
          const fallbackResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': AZURE_API_KEY,
            },
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
                  content: dbUser.systemPrompt || 'You are HIPAA GPT, a helpful medical AI assistant. Provide clear, accurate, and professional responses.'
                },
                ...messages
              ],
              temperature,
              max_completion_tokens: max_tokens,
              stream: true,
            }),
          });

          if (fallbackResponse.ok) {
            console.log('✅ Fallback to Azure OpenAI successful');
            
            // Create a transform stream to capture the assistant's response
            const reader = fallbackResponse.body?.getReader();
            let assistantContent = '';
            
            const stream = new ReadableStream({
              async start(controller) {
                if (!reader) return;
                
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    // Pass through the chunk
                    controller.enqueue(value);
                    
                    // Try to extract content from the chunk
                    const text = new TextDecoder().decode(value);
                    const lines = text.split('\n');
                    
                    for (const line of lines) {
                      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                        try {
                          const data = JSON.parse(line.slice(6));
                          if (data.choices?.[0]?.delta?.content) {
                            assistantContent += data.choices[0].delta.content;
                          }
                        } catch (e) {
                          // Ignore parse errors for partial chunks
                        }
                      }
                    }
                  }
                  
                  // Save assistant's response to database
                  if (assistantContent) {
                    await addMessage(thread.id, 'assistant', assistantContent);
                  }
                } finally {
                  reader.releaseLock();
                }
              }
            });
            
            return new Response(stream, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Thread-Id': thread.id,
                'X-RAG-Fallback': 'true',
              },
            });
          }
        }
        
        const error = await response.text();
        console.error('FastAPI chat error:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to process chat request',
          details: error
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log('✅ FastAPI streaming response successful');
      
      // Create a transform stream to capture the assistant's response
      const reader = response.body?.getReader();
      let assistantContent = '';
      
      const stream = new ReadableStream({
        async start(controller) {
          if (!reader) return;
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              // FastAPI already sends SSE format, just pass it through
              controller.enqueue(value);
              
              // Parse the SSE to extract content for saving
              const text = new TextDecoder().decode(value);
              const lines = text.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.choices?.[0]?.delta?.content) {
                      assistantContent += data.choices[0].delta.content;
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            }
            
            // Save assistant's response to database
            if (assistantContent) {
              await addMessage(thread.id, 'assistant', assistantContent);
            }
          } catch (error) {
            console.error('Stream processing error:', error);
            controller.error(error);
          } finally {
            reader.releaseLock();
            controller.close();
          }
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Thread-Id': thread.id,
          'X-RAG-Enabled': dbUser.settings?.enableRAG ? 'true' : 'false',
        },
      });

    } catch (error) {
      console.error('FastAPI connection error:', error);
      
      // If FastAPI is unreachable, provide helpful error
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        return new Response(JSON.stringify({ 
          error: 'RAG service is not running',
          details: 'Please ensure the FastAPI service is started with: cd rag-service && python main.py',
          fallback: 'Chat will work without RAG capabilities'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      throw error;
    }

  } catch (error) {
    console.error('❌ Chat API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}