import ChatInterfaceV0Azure from '@/chat-interface-v0-azure';
import { AuthChatWrapper } from '@/components/auth-chat-wrapper';

export default function ChatPage() {
  return (
    <AuthChatWrapper>
      <ChatInterfaceV0Azure />
    </AuthChatWrapper>
  );
}