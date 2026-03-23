import { NextRequest } from "next/server"
import crypto from "crypto"
import { db } from "@/lib/db"
import { forgotPasswordSchema } from "@/lib/validations"
import { ok, badRequest, serverError } from "@/lib/api-response"
import { sendPasswordResetEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const { email } = parsed.data

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true },
    })

    // Always return success to prevent email enumeration
    if (!user || !user.password) {
      return ok({ message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve." })
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Remove any existing token for this email
    await db.verificationToken.deleteMany({ where: { identifier: email } })

    await db.verificationToken.create({
      data: { identifier: email, token, expires },
    })

    const result = await sendPasswordResetEmail(email, user.name ?? "Usuário", token)

    return ok({
      message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve.",
      ...(result.devUrl ? { devUrl: result.devUrl } : {}),
    })
  } catch (err) {
    return serverError(err)
  }
}
