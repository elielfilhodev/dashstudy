"use client"

import { useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import {
  UserPlus,
  UserMinus,
  Check,
  X,
  Users,
  Search,
  Loader2,
  CircleDot,
  Clock,
  Mail,
  Trophy,
  Eye,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import { rankFromLevel, levelFromXp } from "@/lib/gamification"

const FriendProfileDialog = dynamic(
  () => import("@/components/friends/friend-profile-dialog").then((m) => m.FriendProfileDialog),
  { ssr: false }
)

interface FriendUser {
  id: string
  name: string
  username: string | null
  displayId: string
  image: string | null
  online: boolean
  lastSeenAt: string | null
  xp: number
  friendshipId: string
  direction: "sent" | "received"
}

interface FriendsData {
  friends: FriendUser[]
  pendingReceived: FriendUser[]
  pendingSent: FriendUser[]
}

function OnlineBadge({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background",
        online ? "bg-green-500" : "bg-muted-foreground/50"
      )}
      title={online ? "Online" : "Offline"}
    />
  )
}

function FriendAvatar({ user }: { user: Pick<FriendUser, "name" | "image" | "online"> }) {
  const fallback = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="relative shrink-0">
      <Avatar className="size-10">
        {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
        <AvatarFallback className="text-sm">{fallback}</AvatarFallback>
      </Avatar>
      <OnlineBadge online={user.online} />
    </div>
  )
}

function FriendCard({
  friend,
  onRemove,
  onInspect,
}: {
  friend: FriendUser
  onRemove: (id: string) => void
  onInspect: (userId: string) => void
}) {
  const levelInfo = levelFromXp(friend.xp)
  const rank = rankFromLevel(levelInfo.level)
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    await fetch(`/api/friends/${friend.friendshipId}`, { method: "DELETE" })
    onRemove(friend.friendshipId)
    setRemoving(false)
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <FriendAvatar user={friend} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{friend.name}</span>
          <Badge className={cn("text-[9px] px-1 py-0 h-4", rank.className)}>
            {rank.icon} {rank.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {friend.username && <span>@{friend.username}</span>}
          <span className="flex items-center gap-0.5">
            {friend.online ? (
              <><CircleDot className="size-2.5 text-green-500" /> Online</>
            ) : (
              <><Clock className="size-2.5" /> Offline</>
            )}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        type="button"
        onClick={() => onInspect(friend.id)}
        title="Ver perfil"
      >
        <Eye className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        type="button"
        onClick={handleRemove}
        disabled={removing}
        title="Remover amigo"
      >
        {removing ? <Loader2 className="size-3 animate-spin" /> : <UserMinus className="size-3.5" />}
      </Button>
    </div>
  )
}

function PendingCard({
  user,
  type,
  onAction,
}: {
  user: FriendUser
  type: "received" | "sent"
  onAction: (id: string, accepted?: boolean) => void
}) {
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null)

  async function handle(action: "accept" | "reject") {
    setLoading(action)
    if (action === "accept") {
      await fetch(`/api/friends/${user.friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      })
      onAction(user.friendshipId, true)
    } else {
      await fetch(`/api/friends/${user.friendshipId}`, { method: "DELETE" })
      onAction(user.friendshipId, false)
    }
    setLoading(null)
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <FriendAvatar user={user} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {user.username ? `@${user.username}` : user.displayId}
          {type === "sent" && " · Aguardando"}
        </p>
      </div>
      {type === "received" && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
            onClick={() => handle("accept")}
            disabled={loading !== null}
            title="Aceitar"
          >
            {loading === "accept" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => handle("reject")}
            disabled={loading !== null}
            title="Recusar"
          >
            {loading === "reject" ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3.5" />}
          </Button>
        </div>
      )}
      {type === "sent" && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={() => handle("reject")}
          disabled={loading !== null}
          title="Cancelar solicitação"
        >
          {loading !== null ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3.5" />}
        </Button>
      )}
    </div>
  )
}

interface Props {
  currentUsername: string | null
  currentDisplayId: string
}

export function FriendsCard({ currentUsername, currentDisplayId }: Props) {
  const { data, isLoading, mutate } = useSWR<FriendsData>("/api/friends", {
    refreshInterval: 30_000,
  })

  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  const [searchInput, setSearchInput] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [searchSuccess, setSearchSuccess] = useState("")

  const friends = data?.friends ?? []
  const pendingReceived = data?.pendingReceived ?? []
  const pendingSent = data?.pendingSent ?? []

  const onlineCount = friends.filter((f) => f.online).length

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault()
    setSearchError("")
    setSearchSuccess("")
    setSearchLoading(true)
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: searchInput.trim().replace(/^@/, "") }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSearchError(json.error ?? "Erro ao enviar solicitação")
      } else {
        setSearchSuccess("Solicitação enviada com sucesso!")
        setSearchInput("")
        mutate()
      }
    } finally {
      setSearchLoading(false)
    }
  }

  function handleRemoveFriend(friendshipId: string) {
    mutate(
      (prev) =>
        prev
          ? { ...prev, friends: prev.friends.filter((f) => f.friendshipId !== friendshipId) }
          : prev,
      false
    )
    globalMutate("/api/friends")
  }

  function handlePendingAction(friendshipId: string, accepted?: boolean) {
    mutate(
      (prev) => {
        if (!prev) return prev
        const received = prev.pendingReceived.filter((f) => f.friendshipId !== friendshipId)
        const sent = prev.pendingSent.filter((f) => f.friendshipId !== friendshipId)
        if (accepted) globalMutate("/api/friends")
        return { ...prev, pendingReceived: received, pendingSent: sent }
      },
      false
    )
    if (accepted) globalMutate("/api/friends")
  }

  const pendingCount = pendingReceived.length + pendingSent.length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="size-4" /> Amigos
          {onlineCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 h-4 font-normal">
              <CircleDot className="size-2.5 text-green-500 mr-1" />
              {onlineCount} online
            </Badge>
          )}
        </CardTitle>

        {/* Your identity */}
        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5">
          <Mail className="size-3 shrink-0" />
          <span>
            {currentUsername ? (
              <>Seu username: <strong className="text-foreground">@{currentUsername}</strong></>
            ) : (
              "Username não definido"
            )}
          </span>
          <span className="ml-auto opacity-60">#{currentDisplayId.slice(0, 6).toUpperCase()}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add friend form */}
        <form onSubmit={handleAddFriend} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input
              placeholder="username do amigo"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setSearchError("")
                setSearchSuccess("")
              }}
              className="pl-7 h-8 text-sm"
            />
          </div>
          <Button type="submit" size="sm" className="h-8 px-3" disabled={!searchInput.trim() || searchLoading}>
            {searchLoading ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
          </Button>
        </form>

        {searchError && <p className="text-xs text-destructive -mt-2">{searchError}</p>}
        {searchSuccess && <p className="text-xs text-green-600 -mt-2">{searchSuccess}</p>}

        <Tabs defaultValue="friends">
          <TabsList className="w-full h-8">
            <TabsTrigger value="friends" className="flex-1 text-xs h-7">
              Amigos {friends.length > 0 && `(${friends.length})`}
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-1 text-xs h-7">
              Pendente
              {pendingCount > 0 && (
                <Badge className="ml-1 size-4 p-0 flex items-center justify-center text-[9px]">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-2">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Search className="size-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Nenhum amigo ainda.</p>
                <p className="text-[11px]">Pesquise pelo username acima!</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {friends.map((f) => (
                  <FriendCard
                    key={f.friendshipId}
                    friend={f}
                    onRemove={handleRemoveFriend}
                    onInspect={(userId) => {
                      setProfileUserId(userId)
                      setProfileOpen(true)
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-2">
            {pendingCount === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Trophy className="size-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Sem solicitações pendentes.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {pendingReceived.length > 0 && (
                  <>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-1">
                      Recebidas ({pendingReceived.length})
                    </p>
                    <div className="divide-y divide-border/50">
                      {pendingReceived.map((f) => (
                        <PendingCard
                          key={f.friendshipId}
                          user={f}
                          type="received"
                          onAction={handlePendingAction}
                        />
                      ))}
                    </div>
                  </>
                )}
                {pendingReceived.length > 0 && pendingSent.length > 0 && (
                  <Separator className="my-2" />
                )}
                {pendingSent.length > 0 && (
                  <>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-1">
                      Enviadas ({pendingSent.length})
                    </p>
                    <div className="divide-y divide-border/50">
                      {pendingSent.map((f) => (
                        <PendingCard
                          key={f.friendshipId}
                          user={f}
                          type="sent"
                          onAction={handlePendingAction}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <FriendProfileDialog
        friendUserId={profileUserId}
        open={profileOpen}
        onOpenChange={(open) => {
          setProfileOpen(open)
          if (!open) setProfileUserId(null)
        }}
      />
    </Card>
  )
}
