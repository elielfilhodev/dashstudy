import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { registerSchema } from "@/lib/validations"
import { created, badRequest, serverError } from "@/lib/api-response"

function generateDisplayId(): string {
  // Short 6-char alphanumeric ID displayed as #XXXXXX
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const { name, username, email, password } = parsed.data

    const [existingEmail, existingUsername] = await Promise.all([
      db.user.findUnique({ where: { email } }),
      db.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } }),
    ])

    if (existingEmail) return badRequest("Já existe uma conta com este e-mail")
    if (existingUsername) return badRequest("Este username já está em uso")

    const hashedPassword = await bcrypt.hash(password, 12)

    // Ensure unique displayId
    let displayId = generateDisplayId()
    let attempts = 0
    while (attempts < 10) {
      const collision = await db.user.findUnique({ where: { displayId } })
      if (!collision) break
      displayId = generateDisplayId()
      attempts++
    }

    const user = await db.user.create({
      data: {
        name,
        username: username.toLowerCase(),
        displayId,
        email,
        password: hashedPassword,
        provider: "email",
        gamification: { create: {} },
      },
      select: { id: true, name: true, username: true, displayId: true, email: true, createdAt: true },
    })

    return created(user)
  } catch (err) {
    return serverError(err)
  }
}
