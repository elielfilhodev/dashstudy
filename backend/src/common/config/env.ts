import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_ACCESS_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  JWT_REFRESH_DAYS: z.coerce.number().int().min(1).max(90).default(7),

  ALLOWED_ORIGINS: z.string().default(''),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(20),
  MAX_BODY_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(26_214_400)
    .default(524_288),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().optional(),

  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  TENOR_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema> & {
  isProduction: boolean;
  allowedOrigins: string[];
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }

  return {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === 'production',
    allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}

export const ENV = 'ENV_CONFIG';
