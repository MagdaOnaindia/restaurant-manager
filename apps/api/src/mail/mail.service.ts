import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, Transporter } from "nodemailer";

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly webUrl: string;

  constructor(config: ConfigService) {
    this.from = config.get("MAIL_FROM", "Restaurant Manager <no-reply@rms.local>");
    this.webUrl = config.get("WEB_URL", "http://localhost:3000");
    const user = config.get<string>("SMTP_USER");
    this.transporter = createTransport({
      host: config.get("SMTP_HOST", "localhost"),
      port: Number(config.get("SMTP_PORT", 1025)),
      secure: false,
      auth: user ? { user, pass: config.get("SMTP_PASS") } : undefined,
    });
  }

  private async send(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      // Un fallo de SMTP no debe romper el flujo de la API; se registra y se sigue.
      this.logger.error(`No se pudo enviar el email "${subject}" a ${to}`, err as Error);
    }
  }

  private layout(title: string, body: string) {
    return `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #c25620;">Restaurant Manager</h2>
        <h3>${title}</h3>
        ${body}
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          Si no esperabas este email, puedes ignorarlo.
        </p>
      </div>`;
  }

  async sendVerificationEmail(to: string, name: string, token: string) {
    const link = `${this.webUrl}/verify-email?token=${token}`;
    await this.send(
      to,
      "Verifica tu email",
      this.layout(
        `Hola, ${name}`,
        `<p>Gracias por registrarte. Confirma tu dirección de email para activar tu cuenta:</p>
         <p><a href="${link}" style="background:#c25620;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Verificar mi email</a></p>
         <p>O copia este enlace en tu navegador:<br><a href="${link}">${link}</a></p>
         <p>El enlace caduca en 24 horas.</p>`,
      ),
    );
  }

  async sendInvitationEmail(to: string, orgName: string, inviterName: string, token: string) {
    const link = `${this.webUrl}/invitation?token=${token}`;
    await this.send(
      to,
      `${inviterName} te invita a ${orgName}`,
      this.layout(
        `Te han invitado a ${orgName}`,
        `<p><strong>${inviterName}</strong> te ha invitado a unirte al equipo de <strong>${orgName}</strong> en Restaurant Manager.</p>
         <p><a href="${link}" style="background:#c25620;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Aceptar invitación</a></p>
         <p>O copia este enlace en tu navegador:<br><a href="${link}">${link}</a></p>
         <p>La invitación caduca en 7 días.</p>`,
      ),
    );
  }

  async sendPasswordResetEmail(to: string, name: string, token: string) {
    const link = `${this.webUrl}/reset-password?token=${token}`;
    await this.send(
      to,
      "Restablece tu contraseña",
      this.layout(
        `Hola, ${name}`,
        `<p>Hemos recibido una solicitud para restablecer tu contraseña:</p>
         <p><a href="${link}" style="background:#c25620;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Cambiar contraseña</a></p>
         <p>O copia este enlace en tu navegador:<br><a href="${link}">${link}</a></p>
         <p>El enlace caduca en 1 hora. Si no lo has pedido tú, no hace falta que hagas nada.</p>`,
      ),
    );
  }
}
