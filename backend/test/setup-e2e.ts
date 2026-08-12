import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { ENV, type Env } from '../src/common/config/env';
import { PrismaService } from '../src/common/prisma/prisma.service';

export type E2EContext = {
  app: NestExpressApplication;
  prisma: PrismaService;
};

export async function bootstrapTestApp(): Promise<E2EContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();

  // Mesma configuração do servidor real — sem isso a suíte testaria um
  // pipeline HTTP diferente do que roda em produção.
  configureApp(app, app.get<Env>(ENV));

  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

/** Limpa as tabelas na ordem inversa das dependências. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "MessageReadReceipt", "Message", "ChatGroupMember", "ChatGroup",
      "BookComment", "BookNote", "Book",
      "Achievement", "Gamification",
      "Task", "AgendaItem", "Goal", "Subject",
      "Friendship", "AcademicProfile", "Course",
      "AuthExchangeCode", "RefreshToken",
      "VerificationToken", "Session", "Account", "User"
    RESTART IDENTITY CASCADE
  `);
}

let counter = 0;

export function uniqueUser() {
  counter += 1;
  const tag = `${Date.now().toString(36)}${counter}`.toLowerCase().slice(-12);
  return {
    name: 'Usuário Teste',
    username: `user${tag}`,
    email: `user${tag}@example.com`,
    password: 'senha123',
    confirmPassword: 'senha123',
    academicLevel: 'GRADUACAO' as const,
    courseName: 'Ciência da Computação',
    startDate: '2024-02-01',
    currentSemester: 3,
  };
}
