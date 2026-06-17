import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { updateUsernameSchema, updateAvatarSchema, updateAcademicProfileSchema } from "@/lib/validations"
import { ok, badRequest, serverError } from "@/lib/api-response"
import { courseDefaults, serializeAcademicProfile } from "@/lib/academic"

const updateBannerUrlSchema = z.object({
  action: z.literal("banner-url"),
  bannerUrl: z.string().url("URL inválida").max(2048),
})

export async function PATCH(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const { action } = body as { action?: string }

    if (action === "username") {
      const parsed = updateUsernameSchema.safeParse(body)
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
      }

      const { username } = parsed.data

      const existing = await db.user.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
          NOT: { id: userId },
        },
      })
      if (existing) return badRequest("Este username já está em uso")

      const updated = await db.user.update({
        where: { id: userId },
        data: { username: username.toLowerCase() },
        select: { username: true },
      })
      return ok(updated)
    }

    if (action === "avatar") {
      const parsed = updateAvatarSchema.safeParse(body)
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "URL inválida")
      }

      const updated = await db.user.update({
        where: { id: userId },
        data: { image: parsed.data.image },
        select: { image: true },
      })
      return ok(updated)
    }

    if (action === "banner-url") {
      const parsed = updateBannerUrlSchema.safeParse(body)
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "URL inválida")
      }

      await db.user.update({
        where: { id: userId },
        data: {
          bannerUrl: parsed.data.bannerUrl,
          bannerBlob: null,
          bannerMime: null,
        },
      })
      return ok({ bannerUrl: parsed.data.bannerUrl })
    }

    if (action === "academic-profile") {
      const parsed = updateAcademicProfileSchema.safeParse(body)
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
      }

      const { courseName, academicLevel, startDate, currentSemester } = parsed.data
      const courseData = courseDefaults(courseName)

      const academicProfile = await db.$transaction(async (tx) => {
        const course = await tx.course.upsert({
          where: { normalizedName: courseData.normalizedName },
          update: {
            name: courseData.name,
            crestIcon: courseData.crestIcon,
            crestColor: courseData.crestColor,
            crestBackground: courseData.crestBackground,
          },
          create: courseData,
        })

        return tx.academicProfile.upsert({
          where: { userId },
          update: {
            courseId: course.id,
            academicLevel,
            startDate: new Date(`${startDate}T00:00:00.000Z`),
            currentSemester,
          },
          create: {
            userId,
            courseId: course.id,
            academicLevel,
            startDate: new Date(`${startDate}T00:00:00.000Z`),
            currentSemester,
          },
          include: { course: true },
        })
      })

      return ok(serializeAcademicProfile(academicProfile))
    }

    return badRequest("Ação inválida. Use action: 'username', 'avatar', 'banner-url' ou 'academic-profile'")
  } catch (err) {
    return serverError(err)
  }
}
