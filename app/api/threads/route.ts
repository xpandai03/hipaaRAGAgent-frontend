import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/db/user';
import { getUserThreads, createThread, deleteThread } from '@/lib/db/chat';

// GET all threads for user
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const dbUser = await getUserByClerkId(user.id);
    if (!dbUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const threads = await getUserThreads(dbUser.id);
    return new Response(JSON.stringify(threads), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching threads:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST create new thread
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const dbUser = await getUserByClerkId(user.id);
    if (!dbUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { title = 'New Chat', tenant = 'amanda' } = await request.json();
    const thread = await createThread(dbUser.id, title, tenant);
    
    return new Response(JSON.stringify(thread), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// DELETE thread
export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const dbUser = await getUserByClerkId(user.id);
    if (!dbUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { threadId } = await request.json();
    await deleteThread(threadId, dbUser.id);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deleting thread:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}