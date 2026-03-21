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
