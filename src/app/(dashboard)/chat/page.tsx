import { Suspense } from "react"
import { ChatView } from "@/components/chat/chat-view"
import { requireUser } from "@/lib/session"

export const metadata = { title: "Chat — Dash Estudos" }

export default async function ChatPage() {
  const user = await requireUser()

  return (
    <div className="full-height-page h-full overflow-hidden">
      <Suspense>
        <ChatView meId={user.id} />
      </Suspense>
    </div>
  )
}
