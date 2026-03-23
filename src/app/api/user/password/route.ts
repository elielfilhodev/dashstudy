import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { changePasswordSchema } from "@/lib/validations"
import { ok, badRequest, forbidden, serverError } from "@/lib/api-response"

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const { currentPassword, newPassword } = parsed.data

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { password: true, provider: true },
    })

    if (!user?.password) {
      return forbidden()
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password)
    if (!passwordMatch) {
      return badRequest("Senha atual incorreta")
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return ok({ message: "Senha alterada com sucesso" })
  } catch (err) {
    return serverError(err)
  }
}
