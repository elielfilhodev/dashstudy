import { z } from 'zod';

export const ACADEMIC_LEVEL_VALUES = [
  'GRADUACAO',
  'MESTRADO',
  'DOUTORADO',
  'TECNOLOGO',
] as const;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}$/;
const usernameRegex = /^[a-z0-9._]+$/;

export const cuid = () => z.string().cuid();

// --- Auth ---------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(80),
    username: z
      .string()
      .min(3, 'Username deve ter pelo menos 3 caracteres')
      .max(30, 'Username deve ter no máximo 30 caracteres')
      .regex(
        usernameRegex,
        'Username só pode conter letras minúsculas, números, . e _',
      ),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string(),
    academicLevel: z.enum(ACADEMIC_LEVEL_VALUES, {
      error: 'Nível acadêmico inválido',
    }),
    courseName: z.string().min(2, 'Informe o nome do curso').max(120),
    startDate: z
      .string()
      .regex(dateRegex, 'Data de início inválida (YYYY-MM-DD)'),
    currentSemester: z.coerce
      .number()
      .int()
      .min(1, 'Semestre inválido')
      .max(30, 'Semestre inválido'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const exchangeCodeSchema = z.object({
  code: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z
      .string()
      .min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: z
      .string()
      .min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

// --- User / perfil ------------------------------------------------------

export const updateUsernameSchema = z.object({
  action: z.literal('username'),
  username: z
    .string()
    .min(3, 'Username deve ter pelo menos 3 caracteres')
    .max(30, 'Username deve ter no máximo 30 caracteres')
    .regex(
      usernameRegex,
      'Username só pode conter letras minúsculas, números, . e _',
    ),
});

export const updateAvatarSchema = z.object({
  action: z.literal('avatar'),
  image: z.string().url('URL de imagem inválida').max(2048),
});

export const updateBannerUrlSchema = z.object({
  action: z.literal('banner-url'),
  bannerUrl: z.string().url('URL de imagem inválida').max(2048),
});

export const updateAcademicProfileSchema = z.object({
  action: z.literal('academic-profile'),
  academicLevel: z.enum(ACADEMIC_LEVEL_VALUES, {
    error: 'Nível acadêmico inválido',
  }),
  courseName: z.string().min(2, 'Informe o nome do curso').max(120),
  startDate: z
    .string()
    .regex(dateRegex, 'Data de início inválida (YYYY-MM-DD)'),
  currentSemester: z.coerce
    .number()
    .int()
    .min(1, 'Semestre inválido')
    .max(30, 'Semestre inválido'),
});

export const updateUserSchema = z.discriminatedUnion('action', [
  updateUsernameSchema,
  updateAvatarSchema,
  updateBannerUrlSchema,
  updateAcademicProfileSchema,
]);

// --- Subjects -----------------------------------------------------------

export const createSubjectSchema = z.object({
  name: z.string().min(1).max(120),
  workload: z.number().int().positive(),
  color: z.string().optional().default('#18181b'),
});

export const updateSubjectProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
});

// --- Agenda -------------------------------------------------------------

export const createAgendaItemSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().regex(dateRegex, 'Data inválida (YYYY-MM-DD)'),
  time: z.string().regex(timeRegex, 'Horário inválido (HH:MM)'),
  location: z.string().max(200).optional().default('Não definido'),
  subjectId: cuid().optional().nullable(),
});

export const updateAgendaItemSchema = createAgendaItemSchema
  .partial()
  .extend({ done: z.boolean().optional() });

// --- Goals --------------------------------------------------------------

export const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  target: z.number().int().positive(),
});

export const updateGoalSchema = z.object({
  done: z.number().int().min(0),
});

// --- Tasks --------------------------------------------------------------

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  details: z.string().max(2000).optional().default(''),
  dueDate: z.string().regex(dateRegex, 'Data inválida (YYYY-MM-DD)'),
  scheduledTime: z
    .string()
    .regex(timeRegex, 'Horário inválido (HH:MM)')
    .optional()
    .nullable(),
  subjectId: cuid().optional().nullable(),
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({ done: z.boolean().optional() });

// --- Gamification -------------------------------------------------------

export const completeTaskSchema = z.object({
  taskId: cuid(),
});

// --- Friends ------------------------------------------------------------

export const addFriendSchema = z.object({
  username: z.string().min(1, 'Informe o username'),
});

export const patchFriendSchema = z.object({
  action: z.enum(['accept', 'reject', 'block']),
});

// --- Chat ---------------------------------------------------------------

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(80),
  description: z.string().max(300).optional().nullable(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional().nullable(),
  coAdminId: cuid().optional().nullable(),
});

export const addGroupMemberSchema = z.object({
  userId: cuid(),
});

export const toggleCoAdminSchema = z.object({
  coAdmin: z.boolean(),
});

export const sendMessageSchema = z
  .object({
    content: z.string().max(4000).default(''),
    attachmentUrl: z.string().url().max(2048).optional().nullable(),
    attachmentType: z.enum(['image', 'gif', 'document']).optional().nullable(),
    attachmentName: z.string().max(255).optional().nullable(),
  })
  .refine((d) => d.content.trim().length > 0 || !!d.attachmentUrl, {
    message: 'Envie uma mensagem ou anexe um arquivo',
  });

export const messagePageSchema = z.object({
  cursor: cuid().optional(),
});

// --- Livraria -----------------------------------------------------------

export const createBookSchema = z.object({
  title: z.string().min(1).max(300),
  author: z.string().max(200).optional().nullable(),
  isbn: z.string().max(32).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  review: z.string().max(8000).optional().nullable(),
  coverUrl: z.string().max(2048).optional().nullable(),
});

export const updateBookSchema = createBookSchema.partial();

export const createBookNoteSchema = z.object({
  body: z.string().min(1).max(8000),
});

export const createBookCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

// --- Gifs ---------------------------------------------------------------

export const gifSearchSchema = z.object({
  q: z.string().optional().default(''),
  limit: z.coerce.number().int().min(1).max(50).optional().default(24),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type CreateAgendaItemInput = z.infer<typeof createAgendaItemSchema>;
export type UpdateAgendaItemInput = z.infer<typeof updateAgendaItemSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
