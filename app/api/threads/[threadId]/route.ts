import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/db/user';
import { getThreadById, setActiveThread, updateThreadTitle } from '@/lib/db/chat';

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

// GET specific thread
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { threadId } = await params;
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

    const thread = await getThreadById(threadId, dbUser.id);
    if (!thread) {
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(thread), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// PATCH update thread
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { threadId } = await params;
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

    const body = await request.json();
    let thread;

    if (body.title) {
      thread = await updateThreadTitle(threadId, body.title);
    }
    
    if (body.isActive) {
      thread = await setActiveThread(threadId, dbUser.id);
    }

    return new Response(JSON.stringify(thread), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating thread:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}