import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/db/user';
import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const CHUNK_SIZE = 1000;

function chunkText(text: string, chunkSize: number = CHUNK_SIZE): string[] {
  // Clean text by removing NULL bytes and other problematic characters
  const cleanedText = text
    .replace(/\0/g, '') // Remove NULL bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // Remove control characters except \t, \n, \r
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  const chunks: string[] = [];
  
  for (let i = 0; i < cleanedText.length; i += chunkSize) {
    chunks.push(cleanedText.slice(i, i + chunkSize).trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await getUserByClerkId(user.id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const documentId = uuidv4();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileContent = buffer.toString('utf-8');

    const chunks = chunkText(fileContent);
    console.log(`Processing ${chunks.length} chunks for document ${file.name}`);

    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();

      // Store chunks without embeddings for now
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Store with NULL embedding - we'll use text search instead
        await client.query(
          `INSERT INTO document_chunks 
           (id, user_id, document_id, chunk_index, chunk_text, embedding, metadata, created_at) 
           VALUES ($1, $2, $3, $4, $5, NULL, $6, NOW())`,
          [
            uuidv4(),
            user.id,
            documentId,
            i,
            chunk,
            JSON.stringify({ filename: file.name, totalChunks: chunks.length }),
          ]
        );
        
        console.log(`Processed chunk ${i + 1}/${chunks.length}`);
      }

      await client.end();

      return NextResponse.json({
        success: true,
        documentId,
        filename: file.name,
        chunksProcessed: chunks.length,
        message: 'Document processed and stored for search'
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      await client.end();
      throw dbError;
    }

  } catch (error) {
    console.error('Document processing error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}