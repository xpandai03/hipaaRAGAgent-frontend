import { prisma } from './prisma';

export async function createThread(userId: string, title: string, tenant: string = 'amanda') {
  try {
    // Set all other threads to inactive
    await prisma.thread.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false }
    });

    // Create new active thread
    const thread = await prisma.thread.create({
      data: {
        userId,
        title,
        tenant,
        isActive: true
      }
    });
    return thread;
  } catch (error) {
    console.error('Error creating thread:', error);
    throw error;
  }
}

export async function getActiveThread(userId: string) {
  try {
    const thread = await prisma.thread.findFirst({
      where: {
        userId,
        isActive: true
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });
    return thread;
  } catch (error) {
    console.error('Error fetching active thread:', error);
    return null;
  }
}

export async function getUserThreads(userId: string) {
  try {
    const threads = await prisma.thread.findMany({
      where: { userId },
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    return threads;
  } catch (error) {
    console.error('Error fetching user threads:', error);
    return [];
  }
}

export async function getThreadById(threadId: string, userId: string) {
  try {
    const thread = await prisma.thread.findFirst({
      where: {
        id: threadId,
        userId
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });
    return thread;
  } catch (error) {
    console.error('Error fetching thread:', error);
    return null;
  }
}

export async function setActiveThread(threadId: string, userId: string) {
  try {
    // Set all threads to inactive
    await prisma.thread.updateMany({
      where: { userId },
      data: { isActive: false }
    });

    // Set selected thread to active
    const thread = await prisma.thread.update({
      where: { id: threadId },
      data: { isActive: true }
    });
    return thread;
  } catch (error) {
    console.error('Error setting active thread:', error);
    throw error;
  }
}

export async function addMessage(threadId: string, role: string, content: string, metadata?: any) {
  try {
    const message = await prisma.message.create({
      data: {
        threadId,
        role,
        content,
        metadata
      }
    });

    // Update thread's updatedAt
    await prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() }
    });

    return message;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}

export async function deleteThread(threadId: string, userId: string) {
  try {
    // Verify ownership
    const thread = await prisma.thread.findFirst({
      where: {
        id: threadId,
        userId
      }
    });

    if (!thread) {
      throw new Error('Thread not found or access denied');
    }

    // Delete thread (messages will cascade delete)
    await prisma.thread.delete({
      where: { id: threadId }
    });

    return true;
  } catch (error) {
    console.error('Error deleting thread:', error);
    throw error;
  }
}

export async function updateThreadTitle(threadId: string, title: string) {
  try {
    const thread = await prisma.thread.update({
      where: { id: threadId },
      data: { title }
    });
    return thread;
  } catch (error) {
    console.error('Error updating thread title:', error);
    throw error;
  }
}