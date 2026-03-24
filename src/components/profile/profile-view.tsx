"use client"

import { useRef, useState } from "react"
import { Activity, Camera, Flame, ImagePlus, Loader2, Medal, Star, Trophy, X, Zap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { levelFromXp, rankFromLevel, ACHIEVEMENTS, RANK_THRESHOLDS } from "@/lib/gamification"
import { FriendsCard } from "@/components/friends/friends-card"
import { ActivityHeatmap } from "@/components/profile/activity-heatmap"
import type { Achievement, Gamification } from "@/types"

interface Props {
  user: {
    name: string
    email: string
    image: string | null
    username: string | null
    displayId: string
    bannerHref: string | null
  }
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

  const avatarFallback = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const [bannerHref, setBannerHref] = useState(user.bannerHref)
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false)
  const [bannerUrl, setBannerUrl] = useState("")
  const [savingBanner, setSavingBanner] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleBannerUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!bannerUrl.trim()) return
    setSavingBanner(true)
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "banner-url", bannerUrl: bannerUrl.trim() }),
      })
      if (!res.ok) {
        const j = await res.json()
        toast.error(j.error ?? "Erro ao salvar banner")
        return
      }
      setBannerHref(bannerUrl.trim())
      setBannerUrl("")
      setBannerDialogOpen(false)
      toast.success("Banner atualizado")
    } finally {
      setSavingBanner(false)
    }
  }

  async function handleBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSavingBanner(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/user/banner", { method: "POST", body: form })
      const j = await res.json()
      if (!res.ok) {
        toast.error(j.error ?? "Erro ao enviar banner")
        return
      }
      setBannerHref(`/api/user/banner?t=${Date.now()}`)
      setBannerDialogOpen(false)
      toast.success("Banner atualizado")
    } finally {
      setSavingBanner(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleRemoveBanner() {
    setSavingBanner(true)
    try {
      await fetch("/api/user/banner", { method: "DELETE" })
      setBannerHref(null)
      setBannerDialogOpen(false)
      toast.success("Banner removido")
    } finally {
      setSavingBanner(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        <p className="text-muted-foreground text-sm">Suas conquistas e estatísticas</p>
      </div>

      {/* User card with banner */}
      <Card className="overflow-hidden">
        {/* Banner */}
        <div className="relative h-32 sm:h-40 group">
          {bannerHref ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerHref}
              alt="Banner do perfil"
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <div
              className={cn(
                "w-full h-full",
                rank.key === "genio" && "bg-linear-to-r from-yellow-400 via-pink-500 to-purple-600",
                rank.key === "grao-mestre" && "bg-linear-to-r from-red-700 to-purple-700",
                rank.key === "mestre" && "bg-linear-to-r from-purple-600 to-red-600",
                rank.key === "diamante" && "bg-linear-to-r from-sky-400 to-blue-600",
                rank.key === "esmeralda" && "bg-linear-to-r from-emerald-400 to-teal-600",
                rank.key === "platina" && "bg-linear-to-r from-cyan-400 to-violet-500",
                rank.key === "ouro" && "bg-linear-to-r from-yellow-400 to-amber-600",
                rank.key === "prata" && "bg-linear-to-r from-zinc-300 to-zinc-500",
                rank.key === "bronze" && "bg-linear-to-r from-amber-700 to-orange-800",
              )}
            />
          )}
          <button
            onClick={() => setBannerDialogOpen(true)}
            className={cn(
              "absolute inset-0 flex items-center justify-center gap-2",
              "bg-black/0 group-hover:bg-black/40 transition-all",
              "text-transparent group-hover:text-white text-sm font-medium"
            )}
            title="Alterar banner"
          >
            <Camera className="size-4" />
            Alterar banner
          </button>
        </div>

        <CardContent className="pt-0">
          {/* Avatar — overlapping the banner */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 sm:-mt-12 mb-4">
            <div className="relative shrink-0 self-start sm:self-auto">
              {rank.key === "genio" ? (
                <div className="avatar-rank-genio-wrapper shadow-lg">
                  <div className="avatar-rank-genio-inner">
                    <Avatar className="size-20 sm:size-24 ring-4 ring-background">
                      {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                      <AvatarFallback className="text-2xl">{avatarFallback}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              ) : (
                <Avatar className={cn("size-20 sm:size-24 ring-4 ring-background shadow-lg", rank.avatarBorder)}>
                  {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                  <AvatarFallback className="text-2xl">{avatarFallback}</AvatarFallback>
                </Avatar>
              )}
              <span className="absolute -bottom-1 -right-1 text-xl">{rank.icon}</span>
            </div>

            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{user.name}</h2>
                {user.username && (
                  <span className="text-sm text-muted-foreground">@{user.username}</span>
                )}
                {streakActive && (
                  <div className="flex items-center gap-1 text-orange-500 text-sm font-medium">
                    <Flame className="size-4" />
                    <span>{streakDays} dias</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">
                #{user.displayId.slice(0, 6).toUpperCase()}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
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
              <span className="font-medium">
                {levelInfo.currentXp} / {levelInfo.nextLevelXp}
              </span>
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

      {/* Banner edit dialog */}
      <Dialog open={bannerDialogOpen} onOpenChange={setBannerDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="size-4" /> Banner do perfil
            </DialogTitle>
            <DialogDescription className="text-xs">
              Use uma imagem do seu computador ou cole a URL de uma imagem online.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload file */}
            <div>
              <Label className="text-xs mb-1.5 block">Enviar arquivo (JPG, PNG, WebP, GIF · máx 4 MB)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleBannerFile}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={savingBanner}
                onClick={() => fileInputRef.current?.click()}
              >
                {savingBanner ? <Loader2 className="size-4 animate-spin mr-2" /> : <Camera className="size-4 mr-2" />}
                Escolher arquivo
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">ou</span>
              <Separator className="flex-1" />
            </div>

            {/* URL */}
            <form onSubmit={handleBannerUrl} className="space-y-2">
              <Label htmlFor="banner-url" className="text-xs">URL da imagem</Label>
              <Input
                id="banner-url"
                placeholder="https://exemplo.com/banner.jpg"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                className="text-sm"
              />
              <Button type="submit" className="w-full" disabled={!bannerUrl.trim() || savingBanner}>
                {savingBanner ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Salvar URL
              </Button>
            </form>
          </div>

          {bannerHref && (
            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={handleRemoveBanner}
                disabled={savingBanner}
              >
                <X className="size-3.5 mr-1.5" /> Remover banner
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Activity heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="size-4" /> Atividade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap rankKey={rank.key} />
        </CardContent>
      </Card>

      {/* Friends card */}
      <FriendsCard currentUsername={user.username} currentDisplayId={user.displayId} />

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
                  <span className="text-[10px] font-medium text-center leading-tight">
                    {r.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground">Lv {r.minLevel}</span>
                  {isCurrentRank && (
                    <Badge variant="secondary" className="text-[8px] px-1 py-0">
                      Atual
                    </Badge>
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
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center shrink-0",
                      unlocked ? "bg-yellow-500/20" : "bg-muted"
                    )}
                  >
                    <Medal
                      className={cn(
                        "size-4",
                        unlocked ? "text-yellow-600" : "text-muted-foreground"
                      )}
                    />
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
                <Badge variant="outline" className="font-mono text-xs">
                  {rule.xp}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
