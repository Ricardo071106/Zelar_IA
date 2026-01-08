import sgMail from '@sendgrid/mail';
import { Event } from '@shared/schema';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️ SENDGRID_API_KEY não encontrada. O envio de emails será simulado.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = 'no-reply@zelar.ia'; // Ajustar conforme sender verificado no SendGrid, ou usar var de ambiente

export class EmailService {
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.log(`📧 [SIMULAÇÃO] Enviando email para ${to}: ${subject}`);
      return true;
    }

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'zelar.ia.suporte@gmail.com', // Fallback
      subject,
      html,
    };

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
  }

  async sendInvitation(to: string, event: Event, creatorName: string = 'Alguém'): Promise<boolean> {
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

        <p>Este evento foi organizado com ajuda da <strong>Zelar IA</strong>.</p>
      </div>
    `;

    return this.sendEmail(to, subject, html);
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

    return this.sendEmail(to, subject, html);
  }
}

export const emailService = new EmailService();
