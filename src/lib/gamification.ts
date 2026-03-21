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

export function rankFromLevel(level: number): RankInfo {
  if (level >= 50) return { key: "diamante", label: "Diamante", className: "bg-sky-500 text-white" }
  if (level >= 30) return { key: "platina", label: "Platina", className: "bg-violet-600 text-white" }
  if (level >= 20) return { key: "ouro", label: "Ouro", className: "bg-yellow-500 text-black" }
  if (level >= 10) return { key: "prata", label: "Prata", className: "bg-zinc-400 text-black" }
  return { key: "bronze", label: "Bronze", className: "bg-orange-700 text-white" }
}

export const ACHIEVEMENTS: Record<string, { label: string; description: string }> = {
  FIRST_TASK: { label: "Primeira Tarefa", description: "Concluiu a primeira tarefa" },
  TEN_TASKS: { label: "Dedicado", description: "Concluiu 10 tarefas" },
  FIFTY_TASKS: { label: "Veterano", description: "Concluiu 50 tarefas" },
  HUNDRED_TASKS: { label: "Centurião", description: "Concluiu 100 tarefas" },
  WEEK_STREAK: { label: "Semana de Fogo", description: "Ofensiva de 7 dias seguidos" },
  MONTH_STREAK: { label: "Mês Imparável", description: "Ofensiva de 30 dias seguidos" },
}
