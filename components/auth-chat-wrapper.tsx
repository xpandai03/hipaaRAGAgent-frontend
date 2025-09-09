'use client';

import { useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { Settings, LogOut, User, FileText } from 'lucide-react';
import { SettingsModal } from './settings-modal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AuthChatWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <div className="relative h-full">
      {/* Top bar with user menu and settings */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {/* Documents button */}
        <Link href={pathname === '/documents' ? '/chat' : '/documents'}>
          <button
            className="p-2 bg-white hover:bg-gray-100 rounded-lg transition shadow-md border border-gray-200"
            title={pathname === '/documents' ? 'Back to Chat' : 'Manage Documents'}
          >
            <FileText className="w-5 h-5 text-gray-700" />
          </button>
        </Link>

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 bg-white hover:bg-gray-100 rounded-lg transition shadow-md border border-gray-200"
          title="Settings"
        >
          <Settings className="w-5 h-5 text-gray-700" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="p-2 bg-white hover:bg-gray-100 rounded-lg transition shadow-md border border-gray-200 flex items-center gap-2"
          >
            <User className="w-5 h-5 text-gray-700" />
            {user?.firstName && (
              <span className="text-sm text-gray-700 hidden sm:block">
                {user.firstName}
              </span>
            )}
          </button>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
              <div className="px-4 py-2 border-b">
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
              <button
                onClick={() => signOut({ redirectUrl: '/sign-in' })}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close user menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}

      {/* Chat interface */}
      {children}

      {/* Settings modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}