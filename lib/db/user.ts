import { prisma } from './prisma';

export async function createUser(clerkId: string, email: string, name?: string) {
  try {
    const user = await prisma.user.create({
      data: {
        clerkId,
        email,
        name,
        settings: {
          create: {}
        }
      },
      include: {
        settings: true
      }
    });
    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function getUserByClerkId(clerkId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: {
        settings: true
      }
    });
    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export async function updateUserSystemPrompt(clerkId: string, systemPrompt: string) {
  try {
    const user = await prisma.user.update({
      where: { clerkId },
      data: { systemPrompt }
    });
    return user;
  } catch (error) {
    console.error('Error updating system prompt:', error);
    throw error;
  }
}

export async function updateUserSettings(userId: string, settings: {
  defaultTenant?: string;
  enableRAG?: boolean;
  maxTokens?: number;
  customVariables?: any;
}) {
  try {
    const userSettings = await prisma.userSettings.update({
      where: { userId },
      data: settings
    });
    return userSettings;
  } catch (error) {
    console.error('Error updating user settings:', error);
    throw error;
  }
}