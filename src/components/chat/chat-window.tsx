"use client"

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react"
import { Send, Image, FileText, X, Loader2, Smile } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GroupSettingsDialog } from "./group-settings-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import useSWR from "swr"
import type {
  ChatGroup,
  ChatMessage,
  ChatUser,
  Conversation,
  MessageAttachmentType,
} from "@/types"

// ---------------------------------------------------------------------------
// Fetcher alinhado com o SWRProvider global
// ---------------------------------------------------------------------------
const fetcher = (url: string): Promise<ChatMessage[]> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fetch error")
    return r.json().then((j: { data?: ChatMessage[] }) => j.data ?? [])
  })

// ---------------------------------------------------------------------------
// Helpers de texto
// ---------------------------------------------------------------------------
function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
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

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------
interface Attachment {
  url: string
  type: MessageAttachmentType
  name: string
}

interface GifResult {
  id: string
  title: string
  url: string
  previewUrl: string
}

interface Props {
  conversation: Conversation
  meId: string
  friends: ChatUser[]
  onGroupUpdated: (g: ChatGroup) => void
  onGroupLeft: () => void
}

// ---------------------------------------------------------------------------
// Sub-componente: renderização de um anexo em uma mensagem
// ---------------------------------------------------------------------------
function MessageAttachment({
  url,
  type,
  name,
}: {
  url: string
  type: MessageAttachmentType
  name: string | null
}) {
  if (type === "image" || type === "gif") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name ?? "imagem"}
          className="max-w-[260px] max-h-48 rounded-xl object-cover"
          loading="lazy"
        />
      </a>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors max-w-[260px]"
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{name ?? "documento"}</span>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Sub-componente: Seletor de GIFs
// ---------------------------------------------------------------------------
function GifPicker({ onSelect }: { onSelect: (gif: GifResult) => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/gifs?q=${encodeURIComponent(q)}&limit=20`)
      const json = await res.json() as { data?: GifResult[] }
      setResults(json.data ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 400)
  }

  return (
    <div className="flex flex-col gap-2 p-2 w-72">
      <Input
        autoFocus
        placeholder="Buscar GIF…"
        value={query}
        onChange={handleChange}
        className="h-8 text-sm"
      />
      <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="col-span-2 flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 && query ? (
          <p className="col-span-2 text-xs text-muted-foreground text-center py-4">
            Nenhum resultado
          </p>
        ) : (
          results.map((gif) => (
            <button
              key={gif.id}
              onClick={() => onSelect(gif)}
              className="rounded overflow-hidden hover:opacity-80 transition-opacity"
              title={gif.title}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gif.previewUrl}
                alt={gif.title}
                className="w-full h-20 object-cover"
                loading="lazy"
              />
            </button>
          ))
        )}
      </div>
      {!process.env.NEXT_PUBLIC_SHOW_TENOR_CREDIT && (
        <p className="text-[10px] text-muted-foreground text-right">via Tenor</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function ChatWindow({
  conversation,
  meId,
  friends,
  onGroupUpdated,
  onGroupLeft,
}: Props) {
  const isDirect = conversation.type === "direct"
  const apiUrl = isDirect
    ? `/api/chat/direct/${conversation.friend.id}`
    : `/api/chat/groups/${conversation.group.id}/messages`

  const { data: messages = [], mutate } = useSWR<ChatMessage[]>(apiUrl, fetcher, {
    refreshInterval: () =>
      typeof document !== "undefined" && document.hidden ? 0 : 5000,
    dedupingInterval: 3000,
  })

  // --- estado do formulário ---
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)

  // --- refs ---
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const gifPickerRef = useRef<HTMLDivElement>(null)

  // Scroll para o fim ao receber novas mensagens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // Fecha o GIF picker ao clicar fora
  useEffect(() => {
    if (!showGifPicker) return
    function onClickOutside(e: MouseEvent) {
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [showGifPicker])

  // --- upload de arquivo ---
  const handleFileChange = useCallback(
    async (
      e: React.ChangeEvent<HTMLInputElement>,
      expectedType: "image" | "document"
    ) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ""

      setUploading(true)
      try {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch("/api/chat/upload", { method: "POST", body: fd })
        const json = await res.json() as { data?: Attachment; error?: string }
        if (!res.ok) {
          toast.error(json.error ?? "Erro ao enviar arquivo")
          return
        }
        setAttachment(json.data!)
      } catch {
        toast.error("Erro ao enviar arquivo")
      } finally {
        setUploading(false)
      }
    },
    []
  )

  // --- selecionar GIF ---
  const handleGifSelect = useCallback((gif: GifResult) => {
    setAttachment({ url: gif.url, type: "gif", name: gif.title })
    setShowGifPicker(false)
  }, [])

  // --- enviar mensagem ---
  const handleSend = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const content = text.trim()
      if (!content && !attachment) return

      setSending(true)
      try {
        const body: Record<string, unknown> = { content }
        if (attachment) {
          body.attachmentUrl = attachment.url
          body.attachmentType = attachment.type
          body.attachmentName = attachment.name
        }

        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const j = await res.json() as { error?: string }
          toast.error(j.error ?? "Erro ao enviar")
          return
        }
        setText("")
        setAttachment(null)
        mutate()
      } finally {
        setSending(false)
        textareaRef.current?.focus()
      }
    },
    [text, attachment, apiUrl, mutate]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const title = isDirect ? conversation.friend.name : conversation.group.name
  const subtitle = isDirect
    ? conversation.friend.online
      ? "online"
      : "offline"
    : `${conversation.group.members.length} membros`

  // Agrupa mensagens por data
  const grouped = useMemo(() => {
    const result: { date: string; msgs: ChatMessage[] }[] = []
    for (const m of messages) {
      const d = formatDate(m.createdAt)
      if (!result.length || result[result.length - 1].date !== d) {
        result.push({ date: d, msgs: [m] })
      } else {
        result[result.length - 1].msgs.push(m)
      }
    }
    return result
  }, [messages])

  const canSend = (text.trim().length > 0 || !!attachment) && !sending && !uploading

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
          <p
            className={cn(
              "text-xs",
              isDirect && conversation.friend.online
                ? "text-green-500"
                : "text-muted-foreground"
            )}
          >
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

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">Sem mensagens ainda. Diga olá!</p>
          </div>
        )}
        {grouped.map(({ date, msgs }) => (
          <div key={date} className="space-y-1">
            {/* Separador de data */}
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
                  {/* Avatar */}
                  {!isMe && !sameAuthor ? (
                    <Avatar className="size-7 shrink-0 mb-0.5">
                      {msg.sender.image && <AvatarImage src={msg.sender.image} />}
                      <AvatarFallback className="text-[9px]">
                        {initials(msg.sender.name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                  ) : !isMe ? (
                    <div className="size-7 shrink-0" />
                  ) : null}

                  {/* Conteúdo */}
                  <div
                    className={cn(
                      "max-w-[70%] space-y-1",
                      isMe ? "items-end" : "items-start",
                      "flex flex-col"
                    )}
                  >
                    {!isMe && !sameAuthor && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {msg.sender.name}
                      </span>
                    )}

                    {/* Anexo (imagem / gif / documento) */}
                    {msg.attachmentUrl && msg.attachmentType && (
                      <MessageAttachment
                        url={msg.attachmentUrl}
                        type={msg.attachmentType}
                        name={msg.attachmentName}
                      />
                    )}

                    {/* Texto */}
                    {msg.content && (
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
                    )}

                    <span className="text-[9px] text-muted-foreground px-1">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Preview do anexo selecionado */}
      {attachment && (
        <div className="shrink-0 px-4 pt-2 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm max-w-xs">
            {attachment.type === "image" || attachment.type === "gif" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.url}
                alt="preview"
                className="size-8 rounded object-cover shrink-0"
              />
            ) : (
              <FileText className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-xs">{attachment.name}</span>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* GIF Picker popover */}
      {showGifPicker && (
        <div
          ref={gifPickerRef}
          className="absolute bottom-20 left-4 z-50 rounded-xl border border-border bg-popover shadow-lg"
        >
          <GifPicker onSelect={handleGifSelect} />
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="shrink-0 px-4 py-3 border-t border-border flex items-end gap-2 relative"
      >
        {/* Botões de mídia */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Upload de imagem */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => handleFileChange(e, "image")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading || !!attachment}
            title="Enviar imagem"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Image className="size-4" />
            )}
          </Button>

          {/* Upload de documento */}
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={(e) => handleFileChange(e, "document")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => docInputRef.current?.click()}
            disabled={uploading || !!attachment}
            title="Enviar documento"
          >
            <FileText className="size-4" />
          </Button>

          {/* GIF picker */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 text-muted-foreground hover:text-foreground",
              showGifPicker && "text-primary"
            )}
            onClick={() => setShowGifPicker((v) => !v)}
            disabled={!!attachment}
            title="Inserir GIF"
          >
            <Smile className="size-4" />
          </Button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachment ? "Adicione uma legenda… (opcional)" : "Mensagem… (Enter para enviar)"}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            "min-h-[40px] max-h-32"
          )}
        />

        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          className="shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
