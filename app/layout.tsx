import type React from "react"
import { ClerkProvider } from '@clerk/nextjs'
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-gray-50 overflow-hidden">{children}</body>
      </html>
    </ClerkProvider>
  )
}

export const metadata = {
  title: 'HIPAA GPT - Medical AI Assistant',
  description: 'HIPAA-compliant medical AI assistant powered by Azure OpenAI',
  generator: 'v0.app'
};
