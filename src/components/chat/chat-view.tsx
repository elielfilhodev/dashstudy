"use client"

import { useState, useCallback } from "react"
import { MessageCircle } from "lucide-react"
import { ChatSidebar } from "./chat-sidebar"
import { ChatWindow } from "./chat-window"
import { cn } from "@/lib/utils"
import useSWR from "swr"
import type { ChatGroup, ChatUser, Conversation } from "@/types"

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((j) => j.data)

interface Props {
  meId: string
}

export function ChatView({ meId }: Props) {
  const { data: conversations = [], mutate: revalidateConvs } = useSWR<Conversation[]>(
    "/api/chat/conversations",
    fetcher,
    { refreshInterval: 5000 }
  )

  const { data: friends = [] } = useSWR<{ friends: ChatUser[] }>(
    "/api/friends",
    (url: string) => fetch(url).then((r) => r.json()).then((j) => j.data?.friends ?? []),
    { refreshInterval: 0 }
  )

  const [active, setActive] = useState<Conversation | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)

  const handleSelect = useCallback((c: Conversation) => {
    setActive(c)
    setSidebarVisible(false)
  }, [])

  const handleGroupCreated = useCallback(
    (group: ChatGroup) => {
      const newConv: Conversation = {
        type: "group",
        group,
        lastMessage: null,
        unread: 0,
      }
      setActive(newConv)
      setSidebarVisible(false)
      revalidateConvs()
    },
    [revalidateConvs]
  )

  const handleGroupUpdated = useCallback(
    (updatedGroup: ChatGroup) => {
      if (active?.type === "group" && active.group.id === updatedGroup.id) {
        setActive({ ...active, group: updatedGroup })
      }
      revalidateConvs()
    },
    [active, revalidateConvs]
  )

  const handleGroupLeft = useCallback(() => {
    setActive(null)
    setSidebarVisible(true)
    revalidateConvs()
  }, [revalidateConvs])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — always visible on desktop, toggle on mobile */}
      <div
        className={cn(
          "md:flex md:w-72 lg:w-80 shrink-0 h-full",
          sidebarVisible ? "flex w-full" : "hidden"
        )}
      >
        <ChatSidebar
          conversations={conversations}
          active={active}
          onSelect={handleSelect}
          onGroupCreated={handleGroupCreated}
        />
      </div>

      {/* Chat window */}
      <div className={cn("flex-1 h-full", !sidebarVisible || active ? "flex" : "hidden md:flex", "flex-col")}>
        {active ? (
          <>
            {/* Mobile back button */}
            <div className="md:hidden px-4 pt-3 shrink-0">
              <button
                onClick={() => setSidebarVisible(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                ← Voltar
              </button>
            </div>
            <ChatWindow
              conversation={active}
              meId={meId}
              friends={friends as ChatUser[]}
              onGroupUpdated={handleGroupUpdated}
              onGroupLeft={handleGroupLeft}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <MessageCircle className="size-12 text-muted-foreground/30" />
            <div>
              <p className="text-muted-foreground font-medium">Selecione uma conversa</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Escolha um amigo ou grupo na lista ao lado
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
