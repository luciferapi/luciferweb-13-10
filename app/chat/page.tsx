import { ChatShell } from "@/components/chat/chat-shell"
import { requireSignedInUser } from "@/lib/auth-session"

export default async function ChatPage() {
  await requireSignedInUser("/chat")
  return <ChatShell />
}
