import { NextRequest, NextResponse } from 'next/server';

// Get backend URL from environment variable
const BACKEND_URL = process.env.BACKEND_API_URL || 'https://web-production-4be73.up.railway.app';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract the last user message from the messages array
    const messages = body.messages || [];
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    const message = lastUserMessage?.content || body.message || 'Hello';
    
    // Forward the request to the FastAPI backend with the expected format
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { error: 'Backend request failed', details: errorText },
        { status: response.status }
      );
    }

    // Check if response is streaming
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('text/event-stream')) {
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        return NextResponse.json({ error: 'No response body' }, { status: 500 });
      }

      const stream = new ReadableStream({
        async start(controller) {
          const decoder = new TextDecoder();
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              controller.enqueue(new TextEncoder().encode(chunk));
            }
          } catch (error) {
            console.error('Stream error:', error);
          } finally {
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Handle JSON response
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}