// ---------------------------------------------------------------------------
// Domain types (mirrors Prisma schema shapes returned by API)
// ---------------------------------------------------------------------------

export type Subject = {
  id: string
  name: string
  workload: number
  progress: number
  color: string
  createdAt: Date | string
  updatedAt: Date | string
}

export type AgendaItem = {
  id: string
  title: string
  date: string
  time: string
  location: string
  done: boolean
  subjectId: string | null
  subject: { id: string; name: string } | null
  createdAt: Date | string
  updatedAt: Date | string
}

export type Goal = {
  id: string
  title: string
  target: number
  done: number
  createdAt: Date | string
  updatedAt: Date | string
}

export type Task = {
  id: string
  title: string
  details: string
  dueDate: string
  done: boolean
  subjectId: string | null
  subject: { id: string; name: string } | null
  createdAt: Date | string
  updatedAt: Date | string
}

export type Achievement = {
  id: string
  key: string
  unlockedAt: string
}

export type LevelInfo = {
  level: number
  currentXp: number
  nextLevelXp: number
  totalXp: number
}

export type Gamification = {
  id: string
  xp: number
  totalCompletions: number
  streakDays: number
  bestStreak: number
  lastCompletionDate: string | null
  weeklyMilestones: number[]
  monthlyMilestones: number[]
  achievements: Achievement[]
  updatedAt: Date | string
}

export type RankKey =
  | "bronze"
  | "prata"
  | "ouro"
  | "platina"
  | "esmeralda"
  | "diamante"
  | "mestre"
  | "grao-mestre"
  | "genio"

export type RankInfo = {
  key: RankKey
  label: string
  className: string
  avatarBorder?: string // only for top 3 ranks
  icon?: string
}

// ---------------------------------------------------------------------------
// View routing
// ---------------------------------------------------------------------------

export type View = "dashboard" | "materias" | "agenda" | "metas" | "atividades" | "perfil"
