import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

export type E2EContext = {
  app: INestApplication;
  prisma: PrismaService;
};

export async function bootstrapTestApp(): Promise<E2EContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.use(json({ limit: 1_048_576 }));
  app.use(urlencoded({ extended: true, limit: 1_048_576 }));
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

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
