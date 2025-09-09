'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the chat page
    router.push('/chat');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">HIPAA GPT</h1>
        <p className="text-gray-600">Redirecting to chat...</p>
      </div>
    </div>
  );
}