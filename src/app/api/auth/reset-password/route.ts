import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { resetPasswordSchema } from "@/lib/validations"
import { ok, badRequest, serverError } from "@/lib/api-response"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const { token, newPassword } = parsed.data

    const record = await db.verificationToken.findUnique({ where: { token } })

    if (!record) {
      return badRequest("Token inválido ou expirado")
    }

    if (record.expires < new Date()) {
      await db.verificationToken.delete({ where: { token } })
      return badRequest("Token inválido ou expirado")
    }

    const user = await db.user.findUnique({
      where: { email: record.identifier },
      select: { id: true },
    })

    if (!user) {
      return badRequest("Token inválido ou expirado")
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    await db.verificationToken.delete({ where: { token } })

    return ok({ message: "Senha redefinida com sucesso" })
  } catch (err) {
    return serverError(err)
  }
}
