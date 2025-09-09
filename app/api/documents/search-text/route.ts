import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { Client } from 'pg';

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, topK = 4 } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'No query provided' }, { status: 400 });
    }

    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();

      // Use PostgreSQL full-text search instead of vector similarity
      const result = await client.query(
        `SELECT 
          id as chunk_id,
          chunk_text,
          ts_rank(to_tsvector('english', chunk_text), plainto_tsquery('english', $2)) as similarity,
          document_id,
          metadata
        FROM document_chunks
        WHERE user_id = $1
          AND to_tsvector('english', chunk_text) @@ plainto_tsquery('english', $2)
        ORDER BY similarity DESC
        LIMIT $3`,
        [user.id, query, topK]
      );

      // If no results with full-text search, try simple ILIKE search
      let chunks = result.rows;
      if (chunks.length === 0) {
        const fallbackResult = await client.query(
          `SELECT 
            id as chunk_id,
            chunk_text,
            1.0 as similarity,
            document_id,
            metadata
          FROM document_chunks
          WHERE user_id = $1
            AND LOWER(chunk_text) LIKE LOWER($2)
          ORDER BY chunk_index
          LIMIT $3`,
          [user.id, `%${query}%`, topK]
        );
        chunks = fallbackResult.rows;
      }

      await client.end();

      const formattedChunks = chunks.map(row => ({
        chunk_id: row.chunk_id,
        text: row.chunk_text,
        similarity: row.similarity,
        document_id: row.document_id,
        metadata: row.metadata
      }));

      return NextResponse.json({
        success: true,
        chunks: formattedChunks,
        query
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      await client.end();
      throw dbError;
    }

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}