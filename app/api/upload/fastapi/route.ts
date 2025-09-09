import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Forward the file to FastAPI
    const fastapiFormData = new FormData();
    fastapiFormData.append('file', file);

    const fastapiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    const response = await fetch(`${fastapiUrl}/upload`, {
      method: 'POST',
      body: fastapiFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`FastAPI error: ${error}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}