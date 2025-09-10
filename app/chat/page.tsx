'use client';

import dynamic from 'next/dynamic';

const ChatInterfaceSimple = dynamic(() => import('@/chat-interface-simple'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Loading chat...</div>
});

export default function ChatPage() {
  return <ChatInterfaceSimple />;
}