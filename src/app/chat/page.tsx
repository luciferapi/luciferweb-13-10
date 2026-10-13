import type { Metadata } from "next"
import { ChatShell } from "@/features/chat/components/chat-shell"

export const metadata: Metadata = {
  title: "AI Chat | LUCIFER AI",
  description: "Use the LUCIFER AI chat workspace to explore ideas and work with AI tools.",
  robots: { index: false, follow: false },
}

export default async function ChatPage() {
  return <ChatShell />
}
