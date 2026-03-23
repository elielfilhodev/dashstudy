"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { GroupCreateDialog } from "./group-create-dialog"
import { cn } from "@/lib/utils"
import type { ChatGroup, Conversation } from "@/types"

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return "agora"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

interface Props {
  conversations: Conversation[]
  active: Conversation | null
  onSelect: (c: Conversation) => void
  onGroupCreated: (g: ChatGroup) => void
}

export function ChatSidebar({ conversations, active, onSelect, onGroupCreated }: Props) {
  return (
    <aside className="w-full h-full flex flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="font-semibold text-sm">Mensagens</span>
        <GroupCreateDialog onCreated={onGroupCreated} />
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhuma conversa ainda.
            </p>
            <p className="text-xs text-muted-foreground">
              Adicione amigos para começar a conversar ou crie um grupo.
            </p>
          </div>
        )}
        {conversations.map((conv) => {
          const isDirect = conv.type === "direct"
          const name = isDirect ? conv.friend.name : conv.group.name
          const image = isDirect ? conv.friend.image : null
          const online = isDirect ? conv.friend.online : false
          const lastMsg = conv.lastMessage
          const isActive =
            active?.type === conv.type &&
            (isDirect
              ? active.type === "direct" && active.friend.id === conv.friend.id
              : active.type === "group" && active.group.id === conv.group.id)

          return (
            <button
              key={isDirect ? `dm-${conv.friend.id}` : `g-${conv.group.id}`}
              onClick={() => onSelect(conv)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                "hover:bg-accent",
                isActive && "bg-accent"
              )}
            >
              <div className="relative shrink-0">
                <Avatar className="size-10">
                  {image && <AvatarImage src={image} />}
                  <AvatarFallback className="text-xs">{initials(name ?? "?")}</AvatarFallback>
                </Avatar>
                {isDirect && online && (
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 border-2 border-background" />
                )}
                {!isDirect && (
                  <span className="absolute -bottom-0.5 -right-0.5 text-[9px] bg-primary text-primary-foreground rounded-full px-1 leading-tight">
                    G
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {lastMsg && (
                      <span className="text-[9px] text-muted-foreground">{formatRelative(lastMsg.createdAt)}</span>
                    )}
                    {conv.unread > 0 && (
                      <Badge className="text-[9px] size-4 p-0 flex items-center justify-center rounded-full">
                        {conv.unread > 9 ? "9+" : conv.unread}
                      </Badge>
                    )}
                  </div>
                </div>
                {lastMsg && (
                  <p className="text-xs text-muted-foreground truncate">
                    {lastMsg.senderId === (active?.type === "direct" ? (active as { friend: { id: string } }).friend.id : "") ? "" : ""}
                    {lastMsg.content}
                  </p>
                )}
                {!lastMsg && (
                  <p className="text-xs text-muted-foreground">Sem mensagens</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
