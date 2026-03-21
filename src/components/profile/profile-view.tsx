"use client"

import { Flame, Medal, Star, Trophy, Zap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { levelFromXp, rankFromLevel, ACHIEVEMENTS, RANK_THRESHOLDS } from "@/lib/gamification"
import type { Achievement, Gamification } from "@/types"

interface Props {
  user: { name: string; email: string; image: string | null }
  gamification: Gamification | null
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function ProfileView({ user, gamification }: Props) {
  const xp = gamification?.xp ?? 0
  const streakDays = gamification?.streakDays ?? 0
  const bestStreak = gamification?.bestStreak ?? 0
  const totalCompletions = gamification?.totalCompletions ?? 0
  const achievements = (gamification?.achievements ?? []) as Achievement[]

  const levelInfo = levelFromXp(xp)
  const rank = rankFromLevel(levelInfo.level)
  const streakActive = streakDays > 0
  const isEliteRank = !!rank.avatarBorder

  const avatarFallback = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        <p className="text-muted-foreground text-sm">Suas conquistas e estatísticas</p>
      </div>

      {/* User card */}
      <Card className={cn(isEliteRank && "border-2", rank.key === "mestre" && "border-red-500/50", rank.key === "grao-mestre" && "border-purple-500/50", rank.key === "genio" && "border-yellow-500/50")}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Avatar with elite border */}
            <div className="relative shrink-0">
              <Avatar className={cn("size-20", rank.avatarBorder)}>
                {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                <AvatarFallback className="text-xl">{avatarFallback}</AvatarFallback>
              </Avatar>
              {isEliteRank && (
                <span className="absolute -bottom-1 -right-1 text-lg">{rank.icon}</span>
              )}
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{user.name}</h2>
                {streakActive && (
                  <div className="flex items-center gap-1 text-orange-500 text-sm font-medium">
                    <Flame className="size-4" />
                    <span>{streakDays} dias</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start flex-wrap">
                <Badge className={cn("text-xs", rank.className)}>
                  {rank.icon} {rank.label}
                </Badge>
                <span className="text-sm text-muted-foreground">Nível {levelInfo.level}</span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* XP progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Zap className="size-3" /> XP para próximo nível
              </span>
              <span className="font-medium">{levelInfo.currentXp} / {levelInfo.nextLevelXp}</span>
            </div>
            <Progress value={(levelInfo.currentXp / levelInfo.nextLevelXp) * 100} className="h-2" />
          </div>

          <Separator className="my-4" />

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4">
            <StatItem label="XP total" value={xp} />
            <StatItem label="Nível" value={levelInfo.level} />
            <StatItem label="Tarefas" value={totalCompletions} />
            <StatItem label="Melhor ofensiva" value={`${bestStreak}d`} />
          </div>
        </CardContent>
      </Card>

      {/* Rank progression */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="size-4" /> Progressão de Elos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {RANK_THRESHOLDS.map((r) => {
              const isCurrentRank = rank.key === r.key
              const isUnlocked = levelInfo.level >= r.minLevel
              return (
                <div
                  key={r.key}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg p-2 border transition-all",
                    isCurrentRank && "border-primary bg-primary/5 scale-105",
                    !isUnlocked && "opacity-40 grayscale",
                    isUnlocked && !isCurrentRank && "border-border"
                  )}
                >
                  <span className="text-2xl">{r.icon}</span>
                  <span className="text-[10px] font-medium text-center leading-tight">{r.label}</span>
                  <span className="text-[9px] text-muted-foreground">Lv {r.minLevel}</span>
                  {isCurrentRank && (
                    <Badge variant="secondary" className="text-[8px] px-1 py-0">Atual</Badge>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Medal className="size-4" /> Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(ACHIEVEMENTS).map(([key, info]) => {
              const unlocked = achievements.find((a) => a.key === key)
              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border p-3 transition-all",
                    unlocked ? "bg-card" : "opacity-40 grayscale"
                  )}
                >
                  <div className={cn(
                    "size-8 rounded-full flex items-center justify-center shrink-0",
                    unlocked ? "bg-yellow-500/20" : "bg-muted"
                  )}>
                    <Medal className={cn("size-4", unlocked ? "text-yellow-600" : "text-muted-foreground")} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{info.label}</p>
                    <p className="text-[10px] text-muted-foreground">{info.description}</p>
                    {unlocked && (
                      <p className="text-[10px] text-muted-foreground">{unlocked.unlockedAt}</p>
                    )}
                  </div>
                  {unlocked && <Star className="size-3 text-yellow-500 shrink-0 ml-auto" />}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* XP rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="size-4" /> Como ganhar XP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {[
              { label: "Tarefa concluída", xp: "+20 XP" },
              { label: "Ofensiva de 7 dias", xp: "+100 XP bônus" },
              { label: "Ofensiva de 30 dias", xp: "+300 XP bônus" },
            ].map((rule) => (
              <li key={rule.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{rule.label}</span>
                <Badge variant="outline" className="font-mono text-xs">{rule.xp}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
