import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId, createUser, updateUserSystemPrompt, updateUserSettings } from '@/lib/db/user';

// GET user settings
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let dbUser = await getUserByClerkId(user.id);
    if (!dbUser) {
      // Auto-create user if not exists
      dbUser = await createUser(
        user.id,
        user.emailAddresses?.[0]?.emailAddress || '',
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined
      );
    }

    return new Response(JSON.stringify({
      systemPrompt: dbUser.systemPrompt,
      settings: dbUser.settings,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// PATCH update user settings
export async function PATCH(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let dbUser = await getUserByClerkId(user.id);
    if (!dbUser) {
      // Auto-create user if not exists
      dbUser = await createUser(
        user.id,
        user.emailAddresses?.[0]?.emailAddress || '',
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined
      );
    }

    const body = await request.json();
    
    // Update system prompt if provided
    if (body.systemPrompt !== undefined) {
      await updateUserSystemPrompt(user.id, body.systemPrompt);
    }
    
    // Update other settings if provided
    const settingsToUpdate: any = {};
    if (body.defaultTenant !== undefined) settingsToUpdate.defaultTenant = body.defaultTenant;
    if (body.enableRAG !== undefined) settingsToUpdate.enableRAG = body.enableRAG;
    if (body.maxTokens !== undefined) settingsToUpdate.maxTokens = body.maxTokens;
    if (body.customVariables !== undefined) settingsToUpdate.customVariables = body.customVariables;
    
    if (Object.keys(settingsToUpdate).length > 0) {
      await updateUserSettings(dbUser.id, settingsToUpdate);
    }

    // Fetch updated user
    const updatedUser = await getUserByClerkId(user.id);
    
    return new Response(JSON.stringify({
      systemPrompt: updatedUser?.systemPrompt,
      settings: updatedUser?.settings,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}