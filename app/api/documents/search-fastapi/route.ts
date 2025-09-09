import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, topK = 5 } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'No query provided' }, { status: 400 });
    }

    try {
      // Call FastAPI search service
      const response = await fetch(`${FASTAPI_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          top_k: topK,
          filters: {
            user_id: user.id
          }
        }),
      });

      if (!response.ok) {
        // Fallback to text search if FastAPI is down
        if (!response.ok && response.status === 0) {
          console.log('FastAPI service unavailable, falling back to text search');
          
          // Proxy to the existing text search endpoint
          const textSearchResponse = await fetch(`${request.url.replace('/search-fastapi', '/search-text')}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({ query, topK })
          });
          
          if (textSearchResponse.ok) {
            return textSearchResponse;
          }
        }
        
        const error = await response.text();
        console.error('FastAPI search error:', error);
        return NextResponse.json({ 
          error: 'Failed to search documents',
          details: error
        }, { status: response.status });
      }

      const searchResults = await response.json();
      
      // Transform FastAPI response to match expected format
      return NextResponse.json({
        success: true,
        chunks: searchResults.results.map((result: any) => ({
          chunk_id: result.id,
          text: result.content,
          similarity: result.score || 1.0,
          metadata: {
            filename: result.filename,
            chunk_index: result.chunk_index
          }
        }))
      });

    } catch (error) {
      console.error('FastAPI connection error:', error);
      
      // If FastAPI is unreachable, fall back to text search
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        console.log('FastAPI unreachable, falling back to text search');
        
        // Proxy to the existing text search endpoint
        const textSearchResponse = await fetch(`${request.url.replace('/search-fastapi', '/search-text')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({ query, topK })
        });
        
        if (textSearchResponse.ok) {
          const data = await textSearchResponse.json();
          return NextResponse.json(data);
        }
      }
      
      throw error;
    }

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ 
      error: 'Search failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}