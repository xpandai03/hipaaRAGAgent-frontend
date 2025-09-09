import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Azure OpenAI configuration
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || '';
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
const DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5-mini';
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';

export async function POST(request: NextRequest) {
  try {
    // Check if Azure credentials are configured
    if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
      console.error('Azure OpenAI credentials not configured');
      return NextResponse.json(
        { error: 'Azure OpenAI not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages, temperature = 0.7, max_tokens = 1000, stream = false } = body;

    // Create Azure OpenAI client
    const client = new OpenAI({
      apiKey: AZURE_API_KEY,
      baseURL: `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}`,
      defaultQuery: { 'api-version': API_VERSION },
      defaultHeaders: {
        'api-key': AZURE_API_KEY,
      },
    });

    if (stream) {
      // Handle streaming response
      const stream = await client.chat.completions.create({
        messages,
        model: DEPLOYMENT_NAME,
        temperature,
        max_tokens,
        stream: true,
      });

      // Create a TransformStream to convert the OpenAI stream to SSE format
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                const sseMessage = `data: ${JSON.stringify({ content })}\n\n`;
                controller.enqueue(encoder.encode(sseMessage));
              }
              
              if (chunk.choices[0]?.finish_reason === 'stop') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
            }
          } catch (error) {
            console.error('Stream error:', error);
            const errorMessage = `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
            controller.enqueue(encoder.encode(errorMessage));
          } finally {
            controller.close();
          }
        },
      });

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Handle non-streaming response
      const completion = await client.chat.completions.create({
        messages,
        model: DEPLOYMENT_NAME,
        temperature,
        max_tokens,
      });

      return NextResponse.json({
        choices: completion.choices,
        usage: completion.usage,
      });
    }
  } catch (error) {
    console.error('Azure OpenAI API error:', error);
    return NextResponse.json(
      { 
        error: 'Azure OpenAI request failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}