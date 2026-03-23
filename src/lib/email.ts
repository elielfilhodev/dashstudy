import nodemailer from "nodemailer"

function getBaseUrl() {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
}

function buildTransporter() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<{ devUrl?: string }> {
  const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const transporter = buildTransporter()

  if (!transporter) {
    console.log(`[DEV] Link de reset para ${email}: ${resetUrl}`)
    return process.env.NODE_ENV === "development" ? { devUrl: resetUrl } : {}
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"Dash Estudos" <noreply@dashstudy.com>`,
    to: email,
    subject: "Recuperação de senha — Dash Estudos",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:8px">
        <h2 style="margin:0 0 16px;font-size:20px;color:#18181b">Recuperação de senha</h2>
        <p style="margin:0 0 8px;color:#52525b">Olá, <strong>${name}</strong>!</p>
        <p style="margin:0 0 24px;color:#52525b">Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;font-size:14px">
          Redefinir senha
        </a>
        <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa">Se você não solicitou a recuperação de senha, ignore este e-mail. Nenhuma alteração será feita.</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e4e4e7" />
        <p style="margin:0;font-size:11px;color:#a1a1aa">Link: ${resetUrl}</p>
      </div>
    `,
  })

  return {}
}
