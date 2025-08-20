import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  generateEventInvite(eventData) {
    const {
      title,
      date,
      time,
      location = '',
      description = '',
      organizer = 'Zelar',
      attendees = []
    } = eventData;

    const formattedDate = new Date(date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedTime = new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Convite: ${title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .event-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Convite para Evento</h1>
            <p>Você foi convidado para participar!</p>
          </div>
          
          <div class="content">
            <div class="event-details">
              <h2>${title}</h2>
              <p><strong>📅 Data:</strong> ${formattedDate}</p>
              <p><strong>🕐 Horário:</strong> ${formattedTime}</p>
              ${location ? `<p><strong>📍 Local:</strong> ${location}</p>` : ''}
              ${description ? `<p><strong>📝 Descrição:</strong> ${description}</p>` : ''}
              <p><strong>👤 Organizador:</strong> ${organizer}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" class="button">✅ Aceitar</a>
              <a href="#" class="button" style="background: #e74c3c;">❌ Recusar</a>
              <a href="#" class="button" style="background: #f39c12;">❓ Talvez</a>
            </div>
            
            <p><strong>📧 Responda este email</strong> para confirmar sua presença ou entre em contato com o organizador.</p>
          </div>
          
          <div class="footer">
            <p>Este convite foi gerado automaticamente pelo Zelar - Assistente de Agendamento</p>
            <p>📱 Disponível no WhatsApp e Telegram</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textTemplate = `
Convite para Evento

${title}

📅 Data: ${formattedDate}
🕐 Horário: ${formattedTime}
${location ? `📍 Local: ${location}` : ''}
${description ? `📝 Descrição: ${description}` : ''}
👤 Organizador: ${organizer}

Para confirmar sua presença, responda este email ou entre em contato com o organizador.

---
Gerado pelo Zelar - Assistente de Agendamento
    `;

    return {
      html: htmlTemplate,
      text: textTemplate,
      subject: `Convite: ${title} - ${formattedDate} às ${formattedTime}`
    };
  }

  async sendInvite(eventData, recipientEmail) {
    try {
      const invite = this.generateEventInvite(eventData);
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipientEmail,
        subject: invite.subject,
        text: invite.text,
        html: invite.html
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email enviado:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        preview: invite.html
      };
      
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      throw error;
    }
  }

  generateInvitePreview(eventData) {
    const invite = this.generateEventInvite(eventData);
    
    return {
      subject: invite.subject,
      html: invite.html,
      text: invite.text
    };
  }

  async sendBulkInvites(eventData, recipientEmails) {
    const results = [];
    
    for (const email of recipientEmails) {
      try {
        const result = await this.sendInvite(eventData, email);
        results.push({ email, success: true, messageId: result.messageId });
      } catch (error) {
        results.push({ email, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

export default EmailService; 