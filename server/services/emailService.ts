import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import { Event } from '@shared/schema';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️ SENDGRID_API_KEY não encontrada. O envio de emails será simulado.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = 'zelar.ia.messages@gmail.com';

function hasSmtpConfig(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export class EmailService {
  private smtpTransporter = hasSmtpConfig()
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: String(process.env.SMTP_SECURE || 'true') === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    console.log(`🔍 Tentando enviar email para ${to}. API Key Length: ${process.env.SENDGRID_API_KEY?.length}`);

    const from = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM || FROM_EMAIL;
    const msg = {
      to,
      from, // Fallback
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''), // Fallback: remove tags se não houver texto explícito
    };

    // 1) Prioridade: SendGrid
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send(msg);
        console.log(`✅ Email enviado via SendGrid para ${to}`);
        return true;
      } catch (error) {
        console.error('❌ Erro ao enviar email via SendGrid:', error);
        if ((error as any).response) {
          console.error((error as any).response.body);
        }
        // Se SendGrid falhar e SMTP existir, tenta SMTP antes de desistir.
      }
    }

    // 2) Fallback grátis: SMTP (ex: Gmail App Password)
    if (this.smtpTransporter) {
      try {
        await this.smtpTransporter.sendMail(msg);
        console.log(`✅ Email enviado via SMTP para ${to}`);
        return true;
      } catch (error) {
        console.error('❌ Erro ao enviar email via SMTP:', error);
        return false;
      }
    }

    // 3) Modo simulado
    console.log("⚠️ Nenhum provedor de email configurado (SendGrid/SMTP). Simulando envio:");
    console.log(`Para: ${to}`);
    console.log(`Assunto: ${subject}`);
    return true;

    /*
    try {
      await sgMail.send(msg);
      console.log(`✅ Email enviado para ${to}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      if ((error as any).response) {
        console.error((error as any).response.body);
      }
      return false;
    }
    */
  }

  async sendInvitation(to: string, event: Event, creatorName: string = 'Alguém', calendarIcsLink?: string): Promise<boolean> {
    const date = new Date(event.startDate).toLocaleString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subject = `Convite: ${event.title}`;

    // Template simples de convite
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">📅 Você foi convidado!</h2>
        <p>Olá,</p>
        <p><strong>${creatorName}</strong> convidou você para o seguinte evento:</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #1F2937;">${event.title}</h3>
          <p style="margin: 10px 0 0; color: #4B5563;">🗓️ ${date}</p>
          ${event.description ? `<p style="margin: 10px 0 0; color: #6B7280;">📝 ${event.description}</p>` : ''}
          ${event.conferenceLink ? `<p style="margin: 10px 0 0;"><a href="${event.conferenceLink}" style="color: #4F46E5;">🎥 Entrar na reunião</a></p>` : ''}
        </div>

        ${calendarIcsLink ? `
        <div style="margin: 20px 0; text-align: center;">
          <a href="${calendarIcsLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            📎 Baixar arquivo .ICS
          </a>
        </div>
        ` : ''}

        <p>Este evento foi organizado com ajuda da <strong>Zelar IA</strong>.</p>
      </div>
    `;

    const text = `
📅 Você foi convidado!

Olá,
${creatorName} convidou você para o seguinte evento:

${event.title}
🗓️ ${date}
${event.description ? `📝 ${event.description}` : ''}
${event.conferenceLink ? `🎥 Entrar na reunião: ${event.conferenceLink}` : ''}

${calendarIcsLink ? `📎 Arquivo .ICS: ${calendarIcsLink}` : ''}

Este evento foi organizado com ajuda da Zelar IA.
    `.trim();

    return this.sendEmail(to, subject, html, text);
  }

  async sendReminder(to: string, event: Event): Promise<boolean> {
    const date = new Date(event.startDate).toLocaleString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const subject = `Lembrete: ${event.title} começa em breve`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #F59E0B;">⏰ Lembrete de Evento</h2>
        <p>Olá,</p>
        <p>Lembre-se que o evento <strong>${event.title}</strong> começará às <strong>${date}</strong>.</p>
        
        ${event.conferenceLink ? `<p><a href="${event.conferenceLink}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Entrar na Reunião</a></p>` : ''}
        
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 20px;">Enviado por Zelar IA</p>
      </div>
    `;

    const text = `
⏰ Lembrete de Evento

Olá,
Lembre-se que o evento "${event.title}" começará às ${date}.

${event.conferenceLink ? `Entrar na Reunião: ${event.conferenceLink}` : ''}

Enviado por Zelar IA
    `.trim();

    return this.sendEmail(to, subject, html, text);
  }
}

export const emailService = new EmailService();
