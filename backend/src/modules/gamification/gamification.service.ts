import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  dayDiff,
  levelFromXp,
  utcDayKey,
  XP_BASE,
  XP_MONTH_BONUS,
  XP_WEEK_BONUS,
} from '../../common/utils/gamification';

const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const gamification = await this.ensureRow(userId);
    return { ...gamification, levelInfo: levelFromXp(gamification.xp) };
  }

  /**
   * Registra a conclusão de uma tarefa: streak, XP, bônus e conquistas.
   * Não marca a tarefa como concluída — quem faz isso é `PATCH /tasks/:id`.
   * Tarefa inexistente, de outro usuário ou já concluída vira no-op silencioso,
   * o que impede premiar a mesma tarefa duas vezes.
   */
  async completeTask(userId: string, taskId: string) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id: taskId },
        select: { userId: true, done: true },
      });
      if (!task || task.userId !== userId || task.done)
        return { skipped: true };

      const current =
        (await tx.gamification.findUnique({
          where: { userId },
          include: { achievements: true },
        })) ??
        (await tx.gamification.create({
          data: { userId },
          include: { achievements: true },
        }));

      const todayKey = utcDayKey();
      const diff = current.lastCompletionDate
        ? dayDiff(current.lastCompletionDate, todayKey)
        : null;

      // Mesmo dia (diff === 0) mantém a ofensiva inalterada.
      let streakDays = current.streakDays;
      if (diff === null || diff > 1) streakDays = 1;
      else if (diff === 1) streakDays += 1;

      const bestStreak = Math.max(streakDays, current.bestStreak);

      let xpEarned = XP_BASE;
      const weeklyMilestones = [...current.weeklyMilestones];
      const monthlyMilestones = [...current.monthlyMilestones];

      if (
        streakDays % DAYS_IN_WEEK === 0 &&
        !weeklyMilestones.includes(streakDays)
      ) {
        xpEarned += XP_WEEK_BONUS;
        weeklyMilestones.push(streakDays);
      }
      if (
        streakDays % DAYS_IN_MONTH === 0 &&
        !monthlyMilestones.includes(streakDays)
      ) {
        xpEarned += XP_MONTH_BONUS;
        monthlyMilestones.push(streakDays);
      }

      const xp = current.xp + xpEarned;
      const totalCompletions = current.totalCompletions + 1;

      const unlocked = new Set(current.achievements.map((a) => a.key));
      const newAchievementKeys = [
        totalCompletions === 1 && 'FIRST_TASK',
        totalCompletions === 10 && 'TEN_TASKS',
        totalCompletions === 50 && 'FIFTY_TASKS',
        totalCompletions === 100 && 'HUNDRED_TASKS',
        streakDays >= 7 && 'WEEK_STREAK',
        streakDays >= 30 && 'MONTH_STREAK',
      ].filter(
        (key): key is string => typeof key === 'string' && !unlocked.has(key),
      );

      if (newAchievementKeys.length > 0) {
        await tx.achievement.createMany({
          data: newAchievementKeys.map((key) => ({
            gamificationId: current.id,
            key,
            unlockedAt: todayKey,
          })),
          skipDuplicates: true,
        });
      }

      const updated = await tx.gamification.update({
        where: { userId },
        data: {
          xp,
          totalCompletions,
          streakDays,
          bestStreak,
          lastCompletionDate: todayKey,
          weeklyMilestones,
          monthlyMilestones,
        },
        include: { achievements: true },
      });

      const levelInfo = levelFromXp(xp);

      return {
        ...updated,
        levelInfo,
        reward: {
          xpEarned,
          leveledUp: levelInfo.level > levelFromXp(current.xp).level,
          newLevel: levelInfo.level,
          streakDays,
        },
        newAchievementKeys,
      };
    });
  }

  private async ensureRow(userId: string) {
    const existing = await this.prisma.gamification.findUnique({
      where: { userId },
      include: { achievements: true },
    });
    if (existing) return existing;

    return this.prisma.gamification.create({
      data: { userId },
      include: { achievements: true },
    });
  }
}
