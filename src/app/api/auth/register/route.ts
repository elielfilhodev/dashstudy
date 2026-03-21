import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { registerSchema } from "@/lib/validations"
import { created, badRequest, serverError } from "@/lib/api-response"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const { name, email, password } = parsed.data
    const existing = await db.user.findUnique({ where: { email } })

    if (existing) {
      return badRequest("Já existe uma conta com este e-mail")
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        provider: "email",
        gamification: { create: {} },
      },
      select: { id: true, name: true, email: true, createdAt: true },
    })

    return created(user)
  } catch (err) {
    return serverError(err)
  }
}
