import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/db/user';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await getUserByClerkId(user.id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the form data from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Create new FormData for FastAPI
    const fastApiFormData = new FormData();
    fastApiFormData.append('file', file);
    fastApiFormData.append('user_id', user.id);

    // Forward to FastAPI service
    const response = await fetch(`${FASTAPI_URL}/upload`, {
      method: 'POST',
      body: fastApiFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('FastAPI upload error:', error);
      
      // Fallback if FastAPI is down
      if (!response.ok && response.status === 0) {
        return NextResponse.json(
          { error: 'RAG service is unavailable. Please try again later.' },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to process document' },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Return success response
    return NextResponse.json({
      success: true,
      documentId: result.document_id,
      filename: result.filename,
      chunksProcessed: result.chunks_created,
      message: result.message || `Document processed successfully`
    });

  } catch (error) {
    console.error('Document upload error:', error);
    
    // Check if FastAPI is unreachable
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      return NextResponse.json(
        { 
          error: 'RAG service is not running. Please ensure the FastAPI service is started.',
          details: 'Start the service with: cd rag-service && python main.py'
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}