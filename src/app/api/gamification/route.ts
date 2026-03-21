import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, serverError } from "@/lib/api-response"
import { z } from "zod"

const completeTaskSchema = z.object({
  taskId: z.string().cuid(),
})

const XP_BASE = 20
const XP_WEEK_BONUS = 100
const XP_MONTH_BONUS = 300
const DAYS_IN_WEEK = 7
const DAYS_IN_MONTH = 30

function levelFromXp(xp: number) {
  let level = 1
  let threshold = 100
  let accumulated = 0
  while (xp >= accumulated + threshold) {
    accumulated += threshold
    level++
    threshold = Math.round(threshold * 1.25)
  }
  return {
    level,
    currentXp: xp - accumulated,
    nextLevelXp: threshold,
    totalXp: xp,
  }
}

export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    let gamification = await db.gamification.findUnique({
      where: { userId },
      include: { achievements: true },
    })

    if (!gamification) {
      gamification = await db.gamification.create({
        data: { userId },
        include: { achievements: true },
      })
    }

    return ok({
      ...gamification,
      levelInfo: levelFromXp(gamification.xp),
    })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = completeTaskSchema.safeParse(body)
    if (!parsed.success) return ok({ skipped: true })

    const task = await db.task.findUnique({ where: { id: parsed.data.taskId } })
    if (!task || task.userId !== userId || task.done) return ok({ skipped: true })

    let gamification = await db.gamification.findUnique({
      where: { userId },
      include: { achievements: true },
    })
    if (!gamification) {
      gamification = await db.gamification.create({
        data: { userId },
        include: { achievements: true },
      })
    }

    const todayKey = new Date().toISOString().split("T")[0]
    const lastDate = gamification.lastCompletionDate
    const dayDiff = lastDate
      ? Math.floor(
          (new Date(todayKey).getTime() - new Date(lastDate).getTime()) /
            86_400_000
        )
      : null

    let newStreak = gamification.streakDays
    if (dayDiff === null || dayDiff > 1) newStreak = 1
    else if (dayDiff === 1) newStreak += 1

    const bestStreak = Math.max(newStreak, gamification.bestStreak)

    let earned = XP_BASE
    const weeklyMilestones = [...gamification.weeklyMilestones]
    const monthlyMilestones = [...gamification.monthlyMilestones]

    if (newStreak % DAYS_IN_WEEK === 0 && !weeklyMilestones.includes(newStreak)) {
      earned += XP_WEEK_BONUS
      weeklyMilestones.push(newStreak)
    }
    if (newStreak % DAYS_IN_MONTH === 0 && !monthlyMilestones.includes(newStreak)) {
      earned += XP_MONTH_BONUS
      monthlyMilestones.push(newStreak)
    }

    const newXp = gamification.xp + earned
    const newTotalCompletions = gamification.totalCompletions + 1

    const unlockIfNeeded = async (key: string) => {
      const exists = gamification!.achievements.find((a) => a.key === key)
      if (!exists) {
        await db.achievement.create({
          data: {
            gamificationId: gamification!.id,
            key,
            unlockedAt: todayKey,
          },
        })
      }
    }

    const newLevelInfo = levelFromXp(newXp)
    const oldLevelInfo = levelFromXp(gamification.xp)

    if (newTotalCompletions === 1) await unlockIfNeeded("FIRST_TASK")
    if (newTotalCompletions === 10) await unlockIfNeeded("TEN_TASKS")
    if (newTotalCompletions === 50) await unlockIfNeeded("FIFTY_TASKS")
    if (newTotalCompletions === 100) await unlockIfNeeded("HUNDRED_TASKS")
    if (newStreak >= 7) await unlockIfNeeded("WEEK_STREAK")
    if (newStreak >= 30) await unlockIfNeeded("MONTH_STREAK")

    const updatedGamification = await db.gamification.update({
      where: { userId },
      data: {
        xp: newXp,
        totalCompletions: newTotalCompletions,
        streakDays: newStreak,
        bestStreak,
        lastCompletionDate: todayKey,
        weeklyMilestones,
        monthlyMilestones,
      },
      include: { achievements: true },
    })

    return ok({
      ...updatedGamification,
      levelInfo: levelFromXp(updatedGamification.xp),
      reward: {
        xpEarned: earned,
        leveledUp: newLevelInfo.level > oldLevelInfo.level,
        newLevel: newLevelInfo.level,
        streakDays: newStreak,
      },
    })
  } catch (err) {
    return serverError(err)
  }
}
