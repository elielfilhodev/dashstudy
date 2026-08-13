import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GamificationService } from './gamification.service';

type GamificationRow = {
  id: string;
  userId: string;
  xp: number;
  totalCompletions: number;
  streakDays: number;
  bestStreak: number;
  lastCompletionDate: string | null;
  weeklyMilestones: number[];
  monthlyMilestones: number[];
  achievements: Array<{ key: string }>;
};

function row(overrides: Partial<GamificationRow> = {}): GamificationRow {
  return {
    id: 'gam1',
    userId: 'user1',
    xp: 0,
    totalCompletions: 0,
    streakDays: 0,
    bestStreak: 0,
    lastCompletionDate: null,
    weeklyMilestones: [],
    monthlyMilestones: [],
    achievements: [],
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

describe('GamificationService.completeTask', () => {
  let service: GamificationService;
  let tx: {
    task: { findUnique: jest.Mock };
    gamification: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    achievement: { createMany: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      task: { findUnique: jest.fn() },
      gamification: {
        findUnique: jest.fn(),
        create: jest.fn(),
        // O update devolve o próprio payload para inspecionarmos o que foi gravado.
        update: jest.fn(({ data }) =>
          Promise.resolve({ ...data, achievements: [] }),
        ),
      },
      achievement: { createMany: jest.fn() },
    };

    const prisma = {
      $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(GamificationService);
    tx.task.findUnique.mockResolvedValue({ userId: 'user1', done: false });
  });

  it('ignora tarefa inexistente', async () => {
    tx.task.findUnique.mockResolvedValue(null);
    await expect(service.completeTask('user1', 'task1')).resolves.toEqual({
      skipped: true,
    });
    expect(tx.gamification.update).not.toHaveBeenCalled();
  });

  it('ignora tarefa de outro usuário', async () => {
    tx.task.findUnique.mockResolvedValue({ userId: 'outro', done: false });
    await expect(service.completeTask('user1', 'task1')).resolves.toEqual({
      skipped: true,
    });
  });

  it('ignora tarefa já concluída — impede premiar duas vezes', async () => {
    tx.task.findUnique.mockResolvedValue({ userId: 'user1', done: true });
    await expect(service.completeTask('user1', 'task1')).resolves.toEqual({
      skipped: true,
    });
    expect(tx.gamification.update).not.toHaveBeenCalled();
  });

  it('cria a linha de gamificação na primeira conclusão', async () => {
    tx.gamification.findUnique.mockResolvedValue(null);
    tx.gamification.create.mockResolvedValue(row());

    const result = await service.completeTask('user1', 'task1');

    expect(tx.gamification.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      xp: 20,
      totalCompletions: 1,
      streakDays: 1,
    });
  });

  it('concede 20 XP base e inicia a ofensiva em 1', async () => {
    tx.gamification.findUnique.mockResolvedValue(row());

    const result = await service.completeTask('user1', 'task1');

    expect(result).toMatchObject({
      xp: 20,
      streakDays: 1,
      bestStreak: 1,
      totalCompletions: 1,
    });
    expect(result).toHaveProperty('reward.xpEarned', 20);
  });

  it('incrementa a ofensiva quando a última conclusão foi ontem', async () => {
    tx.gamification.findUnique.mockResolvedValue(
      row({
        streakDays: 4,
        bestStreak: 9,
        lastCompletionDate: daysAgo(1),
        xp: 80,
      }),
    );

    const result = await service.completeTask('user1', 'task1');

    expect(result).toMatchObject({ streakDays: 5, bestStreak: 9, xp: 100 });
  });

  it('mantém a ofensiva quando já houve conclusão hoje', async () => {
    tx.gamification.findUnique.mockResolvedValue(
      row({ streakDays: 4, lastCompletionDate: daysAgo(0), xp: 80 }),
    );

    const result = await service.completeTask('user1', 'task1');

    expect(result).toMatchObject({ streakDays: 4, xp: 100 });
  });

  it('zera a ofensiva após pular um dia', async () => {
    tx.gamification.findUnique.mockResolvedValue(
      row({ streakDays: 12, bestStreak: 12, lastCompletionDate: daysAgo(3) }),
    );

    const result = await service.completeTask('user1', 'task1');

    expect(result).toMatchObject({ streakDays: 1, bestStreak: 12 });
  });

  it('paga o bônus semanal de 100 XP ao fechar 7 dias', async () => {
    tx.gamification.findUnique.mockResolvedValue(
      row({ streakDays: 6, lastCompletionDate: daysAgo(1) }),
    );

    const result = await service.completeTask('user1', 'task1');

    expect(result).toMatchObject({ xp: 120, streakDays: 7 });
    expect(result).toHaveProperty('reward.xpEarned', 120);
    expect((result as { weeklyMilestones: number[] }).weeklyMilestones).toEqual(
      [7],
    );
  });

  it('não repete o bônus semanal para uma ofensiva já premiada', async () => {
    tx.gamification.findUnique.mockResolvedValue(
      row({
        streakDays: 6,
        lastCompletionDate: daysAgo(1),
        weeklyMilestones: [7],
      }),
    );

    const result = await service.completeTask('user1', 'task1');

    expect(result).toMatchObject({ xp: 20, streakDays: 7 });
  });

  it('paga o bônus mensal de 300 XP ao fechar 30 dias', async () => {
    tx.gamification.findUnique.mockResolvedValue(
      row({ streakDays: 29, lastCompletionDate: daysAgo(1) }),
    );

    const result = await service.completeTask('user1', 'task1');

    expect(result).toMatchObject({ xp: 320, streakDays: 30 });
  });

  it('acumula os dois bônus quando a ofensiva é múltiplo de 7 e de 30', async () => {
    tx.gamification.findUnique.mockResolvedValue(
      row({ streakDays: 209, lastCompletionDate: daysAgo(1) }),
    );

    const result = await service.completeTask('user1', 'task1');

    expect(result).toMatchObject({ xp: 420, streakDays: 210 });
  });

  it('desbloqueia FIRST_TASK na primeira conclusão', async () => {
    tx.gamification.findUnique.mockResolvedValue(row());

    const result = await service.completeTask('user1', 'task1');

    expect(result).toHaveProperty('newAchievementKeys', ['FIRST_TASK']);
    expect(tx.achievement.createMany).toHaveBeenCalled();
  });

  it.each([
    [9, 'TEN_TASKS'],
    [49, 'FIFTY_TASKS'],
    [99, 'HUNDRED_TASKS'],
  ])('desbloqueia %s ao atingir a contagem', async (before, key) => {
    tx.gamification.findUnique.mockResolvedValue(
      row({ totalCompletions: before }),
    );

    const result = await service.completeTask('user1', 'task1');

    expect(
      (result as { newAchievementKeys: string[] }).newAchievementKeys,
    ).toContain(key);
  });

  it('não redesbloqueia uma conquista já obtida', async () => {
    tx.gamification.findUnique.mockResolvedValue(
      row({
        streakDays: 9,
        totalCompletions: 5,
        lastCompletionDate: daysAgo(1),
        achievements: [{ key: 'WEEK_STREAK' }],
      }),
    );

    const result = await service.completeTask('user1', 'task1');

    expect(result).toHaveProperty('newAchievementKeys', []);
    expect(tx.achievement.createMany).not.toHaveBeenCalled();
  });

  it('sinaliza subida de nível quando o XP cruza o limiar', async () => {
    tx.gamification.findUnique.mockResolvedValue(row({ xp: 95 }));

    const result = await service.completeTask('user1', 'task1');

    expect(result).toHaveProperty('reward.leveledUp', true);
    expect(result).toHaveProperty('reward.newLevel', 2);
  });

  it('não sinaliza subida de nível dentro do mesmo patamar', async () => {
    tx.gamification.findUnique.mockResolvedValue(row({ xp: 20 }));

    const result = await service.completeTask('user1', 'task1');

    expect(result).toHaveProperty('reward.leveledUp', false);
  });
});

describe('GamificationService.get', () => {
  let service: GamificationService;
  let findUnique: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    const prisma = {
      gamification: { findUnique, create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(GamificationService);
  });

  it('apaga a chama (streakDays 0) quando a ofensiva foi perdida, sem tocar no recorde', async () => {
    findUnique.mockResolvedValue(
      row({ streakDays: 5, bestStreak: 5, lastCompletionDate: daysAgo(3) }),
    );

    const result = await service.get('user1');

    expect(result).toMatchObject({ streakDays: 0, bestStreak: 5 });
  });

  it('mantém a chama acesa quando a última conclusão foi ontem', async () => {
    findUnique.mockResolvedValue(
      row({ streakDays: 5, bestStreak: 5, lastCompletionDate: daysAgo(1) }),
    );

    const result = await service.get('user1');

    expect(result).toMatchObject({ streakDays: 5, bestStreak: 5 });
  });

  it('mantém a chama acesa quando já houve conclusão hoje', async () => {
    findUnique.mockResolvedValue(
      row({ streakDays: 5, bestStreak: 5, lastCompletionDate: daysAgo(0) }),
    );

    const result = await service.get('user1');

    expect(result).toMatchObject({ streakDays: 5, bestStreak: 5 });
  });
});
