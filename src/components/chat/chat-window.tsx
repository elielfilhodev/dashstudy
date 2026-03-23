"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { GroupSettingsDialog } from "./group-settings-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import useSWR from "swr"
import type { ChatGroup, ChatMessage, ChatUser, Conversation } from "@/types"

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((j) => j.data)

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return "Hoje"
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "Ontem"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

interface Props {
  conversation: Conversation
  meId: string
  friends: ChatUser[]
  onGroupUpdated: (g: ChatGroup) => void
  onGroupLeft: () => void
}

export function ChatWindow({ conversation, meId, friends, onGroupUpdated, onGroupLeft }: Props) {
  const isDirect = conversation.type === "direct"
  const apiUrl = isDirect
    ? `/api/chat/direct/${conversation.friend.id}`
    : `/api/chat/groups/${conversation.group.id}/messages`

  const { data: messages = [], mutate } = useSWR<ChatMessage[]>(apiUrl, fetcher, {
    refreshInterval: 2500,
  })

  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const handleSend = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const content = text.trim()
      if (!content) return
      setSending(true)
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        })
        if (!res.ok) {
          const j = await res.json()
          toast.error(j.error ?? "Erro ao enviar")
          return
        }
        setText("")
        mutate()
      } finally {
        setSending(false)
        textareaRef.current?.focus()
      }
    },
    [text, apiUrl, mutate]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const title = isDirect ? conversation.friend.name : conversation.group.name
  const subtitle = isDirect
    ? conversation.friend.online ? "online" : "offline"
    : `${conversation.group.members.length} membros`

  // Group messages by date
  const grouped: { date: string; msgs: ChatMessage[] }[] = []
  for (const m of messages) {
    const d = formatDate(m.createdAt)
    if (!grouped.length || grouped[grouped.length - 1].date !== d) {
      grouped.push({ date: d, msgs: [m] })
    } else {
      grouped[grouped.length - 1].msgs.push(m)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Avatar className="size-9 shrink-0">
          {isDirect && conversation.friend.image && (
            <AvatarImage src={conversation.friend.image} />
          )}
          <AvatarFallback className="text-xs">{initials(title ?? "?")}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className={cn(
            "text-xs",
            isDirect && conversation.friend.online ? "text-green-500" : "text-muted-foreground"
          )}>
            {subtitle}
          </p>
        </div>
        {!isDirect && (
          <GroupSettingsDialog
            group={conversation.group}
            meId={meId}
            friends={friends}
            onUpdated={onGroupUpdated}
            onLeft={onGroupLeft}
          />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">Sem mensagens ainda. Diga olá!</p>
          </div>
        )}
        {grouped.map(({ date, msgs }) => (
          <div key={date} className="space-y-1">
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">{date}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            {msgs.map((msg, i) => {
              const isMe = msg.senderId === meId
              const prevMsg = i > 0 ? msgs[i - 1] : null
              const sameAuthor = prevMsg?.senderId === msg.senderId
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-end gap-2",
                    isMe ? "flex-row-reverse" : "flex-row",
                    sameAuthor && "mt-0.5"
                  )}
                >
                  {!isMe && !sameAuthor ? (
                    <Avatar className="size-7 shrink-0 mb-0.5">
                      {msg.sender.image && <AvatarImage src={msg.sender.image} />}
                      <AvatarFallback className="text-[9px]">{initials(msg.sender.name ?? "?")}</AvatarFallback>
                    </Avatar>
                  ) : !isMe ? (
                    <div className="size-7 shrink-0" />
                  ) : null}
                  <div className={cn("max-w-[70%] space-y-0.5", isMe ? "items-end" : "items-start", "flex flex-col")}>
                    {!isMe && !sameAuthor && (
                      <span className="text-[10px] text-muted-foreground ml-1">{msg.sender.name}</span>
                    )}
                    <div
                      className={cn(
                        "px-3 py-2 rounded-2xl text-sm leading-relaxed",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="shrink-0 px-4 py-3 border-t border-border flex items-end gap-2"
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem… (Enter para enviar)"
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            "min-h-[40px] max-h-32"
          )}
        />
        <Button type="submit" size="icon" disabled={sending || !text.trim()} className="shrink-0">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
