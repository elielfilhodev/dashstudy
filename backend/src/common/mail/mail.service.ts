import { Inject, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ENV, type Env } from '../config/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transporter = env.SMTP_HOST
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        })
      : null;
  }

  /** Sem SMTP configurado, loga o link e o devolve fora de produção. */
  async sendPasswordReset(
    email: string,
    name: string,
    token: string,
  ): Promise<{ devUrl?: string }> {
    const resetUrl = `${this.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

    if (!this.transporter) {
      this.logger.warn(`[DEV] Link de reset para ${email}: ${resetUrl}`);
      return this.env.isProduction ? {} : { devUrl: resetUrl };
    }

    await this.transporter.sendMail({
      from: this.env.SMTP_FROM ?? '"Dash Estudos" <noreply@dashstudy.com>',
      to: email,
      subject: 'Recuperação de senha — Dash Estudos',
      html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:8px">
        <h2 style="margin:0 0 16px;font-size:20px;color:#18181b">Recuperação de senha</h2>
        <p style="margin:0 0 8px;color:#52525b">Olá, <strong>${escapeHtml(name)}</strong>!</p>
        <p style="margin:0 0 24px;color:#52525b">Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;font-size:14px">
          Redefinir senha
        </a>
        <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa">Se você não solicitou a recuperação de senha, ignore este e-mail. Nenhuma alteração será feita.</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e4e4e7" />
        <p style="margin:0;font-size:11px;color:#a1a1aa">Link: ${resetUrl}</p>
      </div>
      `,
    });

    return {};
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
