import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ChatView } from "@/components/chat/chat-view"

export const metadata = { title: "Chat — Dash Estudos" }

export default async function ChatPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return (
    <div className="full-height-page h-full overflow-hidden">
      <ChatView meId={session.user.id} />
    </div>
  )
}
