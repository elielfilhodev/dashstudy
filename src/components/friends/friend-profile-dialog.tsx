"use client"

import useSWR from "swr"
import { Eye, Flame, Loader2, Lock, Medal, Zap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ACHIEVEMENTS, levelFromXp, rankFromLevel } from "@/lib/gamification"

type ProfilePayload = {
  user: {
    id: string
    name: string
    username: string | null
    displayId: string
    image: string | null
    online: boolean
    lastSeenAt: string | null
  }
  gamification: {
    xp: number
    totalCompletions: number
    streakDays: number
    bestStreak: number
    achievements: { key: string; unlockedAt: string }[]
  }
}

async function fetchProfile(url: string): Promise<ProfilePayload> {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error ?? "Não foi possível carregar o perfil")
  }
  return json.data as ProfilePayload
}

type Props = {
  friendUserId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FriendProfileDialog({ friendUserId, open, onOpenChange }: Props) {
  const key = open && friendUserId ? `/api/friends/profile/${friendUserId}` : null
  const { data, error, isLoading } = useSWR<ProfilePayload>(key, fetchProfile, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const u = data?.user
  const g = data?.gamification
  const xp = g?.xp ?? 0
  const levelInfo = levelFromXp(xp)
  const rank = rankFromLevel(levelInfo.level)
  const streakActive = (g?.streakDays ?? 0) > 0

  const avatarFallback = (u?.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="size-4 opacity-70" />
            Perfil do amigo
          </DialogTitle>
          <DialogDescription className="text-xs flex items-center gap-1.5">
            <Lock className="size-3 shrink-0" />
            Somente visualização — dados públicos da gamificação.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center py-6">
            {(error as Error).message}
          </p>
        )}

        {!isLoading && !error && u && g && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <div className="relative shrink-0">
                  {rank.key === "genio" ? (
                    <div className="avatar-rank-genio-wrapper">
                      <div className="avatar-rank-genio-inner">
                        <Avatar className="size-16">
                          {u.image ? <AvatarImage src={u.image} alt={u.name} /> : null}
                          <AvatarFallback className="text-lg">{avatarFallback}</AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  ) : (
                    <Avatar className={cn("size-16", rank.avatarBorder)}>
                      {u.image ? <AvatarImage src={u.image} alt={u.name} /> : null}
                      <AvatarFallback className="text-lg">{avatarFallback}</AvatarFallback>
                    </Avatar>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 text-base">{rank.icon}</span>
                </div>
                <div className="text-center sm:text-left flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{u.name}</h3>
                  {u.username && (
                    <p className="text-sm text-muted-foreground">@{u.username}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/80 font-mono mt-0.5">
                    #{u.displayId.slice(0, 6).toUpperCase()}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
                    <Badge className={cn("text-xs", rank.className)}>
                      {rank.icon} {rank.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Nível {levelInfo.level}</span>
                    {streakActive && (
                      <span className="flex items-center gap-0.5 text-xs text-orange-500 font-medium">
                        <Flame className="size-3.5" />
                        {g.streakDays} dias
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {u.online ? (
                      <span className="text-green-600">Online</span>
                    ) : (
                      <span>Offline</span>
                    )}
                  </p>
                </div>
              </div>

              <Separator className="my-3" />

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Zap className="size-3" /> XP / próximo nível
                  </span>
                  <span className="font-medium tabular-nums">
                    {levelInfo.currentXp} / {levelInfo.nextLevelXp}
                  </span>
                </div>
                <Progress
                  value={(levelInfo.currentXp / levelInfo.nextLevelXp) * 100}
                  className="h-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-muted/50 py-2">
                <p className="text-lg font-bold tabular-nums">{g.totalCompletions}</p>
                <p className="text-muted-foreground">Tarefas</p>
              </div>
              <div className="rounded-md bg-muted/50 py-2">
                <p className="text-lg font-bold tabular-nums">{g.bestStreak}</p>
                <p className="text-muted-foreground">Melhor ofensiva</p>
              </div>
              <div className="rounded-md bg-muted/50 py-2">
                <p className="text-lg font-bold tabular-nums">{g.achievements.length}</p>
                <p className="text-muted-foreground">Conquistas</p>
              </div>
            </div>

            {g.achievements.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Medal className="size-3" /> Conquistas
                </p>
                <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {g.achievements.map((a) => {
                    const meta = ACHIEVEMENTS[a.key]
                    return (
                      <li
                        key={`${a.key}-${a.unlockedAt}`}
                        className="text-xs rounded-md border border-border/60 px-2 py-1.5 bg-muted/20"
                      >
                        <span className="font-medium">{meta?.label ?? a.key}</span>
                        {meta?.description && (
                          <span className="text-muted-foreground block text-[11px]">
                            {meta.description}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
