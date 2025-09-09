import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId, createUser } from '@/lib/db/user';
import { getActiveThread, createThread, addMessage } from '@/lib/db/chat';

// Azure OpenAI configuration
const AZURE_ENDPOINT = 'https://adavi-mf694jmx-eastus2.cognitiveservices.azure.com';
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || 'your_azure_openai_api_key_here';

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
    const { messages, temperature = 1, max_tokens = 1000, threadId, tenant = 'amanda' } = body;

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

    // Check if RAG is enabled for this user
    let ragContext = '';
    let citedSources: any[] = [];
    
    if (dbUser.settings?.enableRAG && userMessage?.content) {
      try {
        // Use text search (faster, no embeddings needed)
        const searchResponse = await fetch(`${request.url.split('/api/chat')[0]}/api/documents/search-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            query: userMessage.content,
            topK: 4
          })
        });

        if (searchResponse.ok) {
          const searchResults = await searchResponse.json();
          
          if (searchResults.success && searchResults.chunks?.length > 0) {
            // Build context from search results
            ragContext = '\n\nRELEVANT DOCUMENTS FROM YOUR KNOWLEDGE BASE:\n' +
              searchResults.chunks.map((chunk: any, i: number) => 
                `[${i+1}] ${chunk.text}`
              ).join('\n\n');
            
            // Track citations for response
            citedSources = searchResults.chunks.map((chunk: any) => ({
              id: chunk.chunk_id,
              preview: chunk.text.substring(0, 100) + '...',
              similarity: chunk.similarity,
              metadata: chunk.metadata
            }));
            
            console.log(`RAG: Found ${searchResults.chunks.length} relevant documents for user ${dbUser.id}`);
          } else {
            console.log(`RAG: No documents found for user ${dbUser.id}`);
          }
        }
      } catch (error) {
        console.error('RAG search failed:', error);
        // Continue without RAG context if it fails
      }
    }

    // Add user's custom system prompt with optional RAG context
    const systemMessage = {
      role: 'system',
      content: (dbUser.systemPrompt || 'You are HIPAA GPT, a helpful medical AI assistant. Provide clear, accurate, and professional responses.') + ragContext
    };
    
    const messagesWithSystem = [systemMessage, ...messages];

    console.log('=== AZURE OPENAI API CALL ===');
    console.log('User:', dbUser.email);
    console.log('Thread:', thread.id);
    console.log('System Prompt:', systemMessage.content);
    console.log('Temperature:', temperature);
    console.log('Max tokens:', max_tokens);

    // Use the deployed model name
    const DEPLOYMENT_NAME = 'gpt-5-mini';
    const API_VERSION = '2024-08-01-preview';

    const url = `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=${API_VERSION}`;
    console.log(`Calling Azure OpenAI: ${DEPLOYMENT_NAME}`);
    
    // Try streaming first
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_API_KEY,
      },
      body: JSON.stringify({
        messages: messagesWithSystem,
        temperature,
        max_completion_tokens: max_tokens,
        stream: true,
      }),
    });

    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Streaming response successful');
      
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
          'X-Citations': citedSources.length > 0 ? JSON.stringify(citedSources) : '',
        },
      });
    } else {
      // If streaming fails, try non-streaming
      console.log('Streaming failed, trying non-streaming...');
      const nonStreamResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_API_KEY,
        },
        body: JSON.stringify({
          messages: messagesWithSystem,
          temperature,
          max_completion_tokens: max_tokens,
          stream: false,
        }),
      });
      
      if (nonStreamResponse.ok) {
        const data = await nonStreamResponse.json();
        console.log('✅ Non-streaming response successful');
        
        // Save assistant's response to database
        if (data.choices?.[0]?.message?.content) {
          await addMessage(thread.id, 'assistant', data.choices[0].message.content);
        }
        
        return new Response(JSON.stringify({ ...data, threadId: thread.id }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        const errorText = await nonStreamResponse.text();
        console.error('❌ Both streaming and non-streaming failed:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Failed to connect to Azure OpenAI',
          details: errorText
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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