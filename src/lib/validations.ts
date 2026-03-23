import { z } from "zod"

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
})

export const registerSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(80),
    username: z
      .string()
      .min(3, "Username deve ter pelo menos 3 caracteres")
      .max(30, "Username deve ter no máximo 30 caracteres")
      .regex(/^[a-z0-9._]+$/, "Username só pode conter letras minúsculas, números, . e _"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export const createSubjectSchema = z.object({
  name: z.string().min(1).max(120),
  workload: z.number().int().positive(),
  color: z.string().optional().default("#18181b"),
})

export const updateSubjectProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
})

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const timeRegex = /^\d{2}:\d{2}$/

export const createAgendaItemSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().regex(dateRegex, "Data inválida (YYYY-MM-DD)"),
  time: z.string().regex(timeRegex, "Horário inválido (HH:MM)"),
  location: z.string().max(200).optional().default("Não definido"),
  subjectId: z.string().cuid().optional().nullable(),
})

export const updateAgendaItemSchema = createAgendaItemSchema.partial().extend({
  done: z.boolean().optional(),
})

export type CreateAgendaItemInput = z.infer<typeof createAgendaItemSchema>
export type UpdateAgendaItemInput = z.infer<typeof updateAgendaItemSchema>

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  target: z.number().int().positive(),
})

export const updateGoalSchema = z.object({
  done: z.number().int().min(0),
})

export type CreateGoalInput = z.infer<typeof createGoalSchema>

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  details: z.string().max(2000).optional().default(""),
  dueDate: z.string().regex(dateRegex, "Data inválida (YYYY-MM-DD)"),
  subjectId: z.string().cuid().optional().nullable(),
})

export const updateTaskSchema = createTaskSchema.partial().extend({
  done: z.boolean().optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

// ---------------------------------------------------------------------------
// Livraria
// ---------------------------------------------------------------------------

export const createBookSchema = z.object({
  title: z.string().min(1).max(300),
  author: z.string().max(200).optional().nullable(),
  isbn: z.string().max(32).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  review: z.string().max(8000).optional().nullable(),
  coverUrl: z.string().max(2048).optional().nullable(),
})

export const updateBookSchema = createBookSchema.partial()

export const createBookNoteSchema = z.object({
  body: z.string().min(1).max(8000),
})

export const createBookCommentSchema = z.object({
  body: z.string().min(1).max(2000),
})

export type CreateBookInput = z.infer<typeof createBookSchema>
export type UpdateBookInput = z.infer<typeof updateBookSchema>

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username deve ter pelo menos 3 caracteres")
    .max(30, "Username deve ter no máximo 30 caracteres")
    .regex(/^[a-z0-9._]+$/, "Username só pode conter letras minúsculas, números, . e _"),
})

export const updateAvatarSchema = z.object({
  image: z.string().url("URL de imagem inválida").max(2048),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  })

export type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
