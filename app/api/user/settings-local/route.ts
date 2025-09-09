import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

// Share storage with chat API
declare global {
  var userSettingsStore: Map<string, any> | undefined;
}

// Use global to persist across hot reloads in development
const userSettings = global.userSettingsStore || new Map<string, any>();
if (!global.userSettingsStore) {
  global.userSettingsStore = userSettings;
}

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

    // Get settings from memory or return defaults
    const settings = userSettings.get(user.id) || {
      systemPrompt: 'You are HIPAA GPT, a helpful medical AI assistant. Provide clear, accurate, and professional responses.',
      settings: {
        defaultTenant: 'amanda',
        enableRAG: false,
        maxTokens: 1000,
      }
    };

    return new Response(JSON.stringify(settings), {
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

    const body = await request.json();
    
    // Get existing settings or create new ones
    const existingSettings = userSettings.get(user.id) || {
      systemPrompt: 'You are HIPAA GPT, a helpful medical AI assistant. Provide clear, accurate, and professional responses.',
      settings: {
        defaultTenant: 'amanda',
        enableRAG: false,
        maxTokens: 1000,
      }
    };
    
    // Update settings
    const updatedSettings = {
      systemPrompt: body.systemPrompt !== undefined ? body.systemPrompt : existingSettings.systemPrompt,
      settings: {
        defaultTenant: body.defaultTenant !== undefined ? body.defaultTenant : existingSettings.settings.defaultTenant,
        enableRAG: body.enableRAG !== undefined ? body.enableRAG : existingSettings.settings.enableRAG,
        maxTokens: body.maxTokens !== undefined ? body.maxTokens : existingSettings.settings.maxTokens,
        customVariables: body.customVariables !== undefined ? body.customVariables : existingSettings.settings.customVariables,
      }
    };
    
    // Store in memory
    userSettings.set(user.id, updatedSettings);
    
    return new Response(JSON.stringify(updatedSettings), {
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