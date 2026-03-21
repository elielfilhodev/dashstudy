import type { LevelInfo, RankInfo } from "@/types"

export function levelFromXp(xp: number): LevelInfo {
  let level = 1
  let threshold = 100
  let accumulated = 0
  while (xp >= accumulated + threshold) {
    accumulated += threshold
    level++
    threshold = Math.round(threshold * 1.25)
  }
  return {
    level,
    currentXp: xp - accumulated,
    nextLevelXp: threshold,
    totalXp: xp,
  }
}

// ---------------------------------------------------------------------------
// 9-tier rank system
// Tiers 7-9 (Mestre, Grão-Mestre, Gênio) get avatar border styling
// ---------------------------------------------------------------------------

export function rankFromLevel(level: number): RankInfo {
  if (level >= 90)
    return {
      key: "genio",
      label: "Gênio",
      className: "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 text-white",
      avatarBorder: "ring-4 ring-offset-2 ring-offset-background ring-gradient-to-r from-yellow-400 via-pink-500 to-purple-600",
      icon: "✨",
    }
  if (level >= 75)
    return {
      key: "grao-mestre",
      label: "Grão-Mestre",
      className: "bg-purple-700 text-white",
      avatarBorder: "ring-4 ring-offset-2 ring-offset-background ring-purple-600",
      icon: "👑",
    }
  if (level >= 60)
    return {
      key: "mestre",
      label: "Mestre",
      className: "bg-red-600 text-white",
      avatarBorder: "ring-4 ring-offset-2 ring-offset-background ring-red-500",
      icon: "🔥",
    }
  if (level >= 50)
    return {
      key: "diamante",
      label: "Diamante",
      className: "bg-sky-500 text-white",
      icon: "💎",
    }
  if (level >= 40)
    return {
      key: "esmeralda",
      label: "Esmeralda",
      className: "bg-emerald-500 text-white",
      icon: "💚",
    }
  if (level >= 30)
    return {
      key: "platina",
      label: "Platina",
      className: "bg-violet-500 text-white",
      icon: "🔷",
    }
  if (level >= 20)
    return {
      key: "ouro",
      label: "Ouro",
      className: "bg-yellow-500 text-black",
      icon: "🥇",
    }
  if (level >= 10)
    return {
      key: "prata",
      label: "Prata",
      className: "bg-zinc-400 text-black",
      icon: "🥈",
    }
  return {
    key: "bronze",
    label: "Bronze",
    className: "bg-orange-700 text-white",
    icon: "🥉",
  }
}

export const RANK_THRESHOLDS: Array<{ key: string; label: string; minLevel: number; icon: string }> = [
  { key: "bronze",      label: "Bronze",      minLevel: 1,  icon: "🥉" },
  { key: "prata",       label: "Prata",       minLevel: 10, icon: "🥈" },
  { key: "ouro",        label: "Ouro",        minLevel: 20, icon: "🥇" },
  { key: "platina",     label: "Platina",     minLevel: 30, icon: "🔷" },
  { key: "esmeralda",   label: "Esmeralda",   minLevel: 40, icon: "💚" },
  { key: "diamante",    label: "Diamante",    minLevel: 50, icon: "💎" },
  { key: "mestre",      label: "Mestre",      minLevel: 60, icon: "🔥" },
  { key: "grao-mestre", label: "Grão-Mestre", minLevel: 75, icon: "👑" },
  { key: "genio",       label: "Gênio",       minLevel: 90, icon: "✨" },
]

export const ACHIEVEMENTS: Record<string, { label: string; description: string }> = {
  FIRST_TASK:    { label: "Primeira Tarefa",  description: "Concluiu a primeira tarefa" },
  TEN_TASKS:     { label: "Dedicado",         description: "Concluiu 10 tarefas" },
  FIFTY_TASKS:   { label: "Veterano",         description: "Concluiu 50 tarefas" },
  HUNDRED_TASKS: { label: "Centurião",        description: "Concluiu 100 tarefas" },
  WEEK_STREAK:   { label: "Semana de Fogo",   description: "Ofensiva de 7 dias seguidos" },
  MONTH_STREAK:  { label: "Mês Imparável",    description: "Ofensiva de 30 dias seguidos" },
}
