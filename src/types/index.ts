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
  scheduledTime: string | null
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
  avatarBorder: string
  icon?: string
}

// ---------------------------------------------------------------------------
// View routing
// ---------------------------------------------------------------------------

export type View =
  | "dashboard"
  | "materias"
  | "agenda"
  | "metas"
  | "atividades"
  | "livraria"
  | "perfil"

export type BookListItem = {
  id: string
  title: string
  author: string | null
  isbn: string | null
  rating: number | null
  coverUrl: string | null
  hasCover: boolean
  coverImageHref: string | null
  notesCount: number
  commentsCount: number
  createdAt: string
  updatedAt: string
}

export type BookComment = {
  id: string
  body: string
  createdAt: string
  user: {
    id: string
    name: string
    username: string | null
    displayId: string
    image: string | null
  }
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export type ChatUser = {
  id: string
  name: string
  username: string | null
  displayId: string
  image: string | null
  online?: boolean
}

export type ChatGroup = {
  id: string
  name: string
  description: string | null
  adminId: string
  coAdminId: string | null
  admin: ChatUser
  coAdmin: ChatUser | null
  members: ChatGroupMember[]
  createdAt: string
  updatedAt: string
}

export type ChatGroupMember = {
  id: string
  groupId: string
  userId: string
  user: ChatUser
  joinedAt: string
}

export type ChatMessage = {
  id: string
  content: string
  senderId: string
  sender: ChatUser
  recipientId: string | null
  groupId: string | null
  createdAt: string
}

export type Conversation =
  | { type: "direct"; friend: ChatUser; lastMessage: ChatMessage | null; unread: number }
  | { type: "group"; group: ChatGroup; lastMessage: ChatMessage | null; unread: number }
