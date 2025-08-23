class EmailService {
  constructor() {
    console.log('✅ EmailService inicializado - funcionalidade mailto automática');
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

    // Texto simples para mailto
    const textInvite = `🎉 CONVITE PARA EVENTO

📅 ${title}

📆 Data: ${formattedDate}
🕐 Horário: ${formattedTime}
${location ? `📍 Local: ${location}` : ''}
${description ? `📝 Descrição: ${description}` : ''}
👤 Organizador: ${organizer}

Para confirmar sua presença, responda este email.

---
Gerado pelo Zelar - Assistente de Agendamento
📱 Disponível no WhatsApp e Telegram`;

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
      text: textInvite,
      subject: `Convite: ${title} - ${formattedDate} às ${formattedTime}`,
      textInvite: textInvite
    };
  }

  generateMailtoLink(eventData, recipientEmail = '') {
    const invite = this.generateEventInvite(eventData);
    
    const subject = encodeURIComponent(invite.subject);
    const body = encodeURIComponent(invite.textInvite);
    const to = recipientEmail ? encodeURIComponent(recipientEmail) : '';
    
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  generateMultipleMailtoLinks(eventData, recipientEmails = []) {
    const links = recipientEmails.map(email => ({
      email,
      link: this.generateMailtoLink(eventData, email)
    }));
    
    return {
      individual: links,
      single: this.generateMailtoLink(eventData) // Link sem destinatário
    };
  }



  generateInvitePreview(eventData) {
    const invite = this.generateEventInvite(eventData);
    
    return {
      subject: invite.subject,
      html: invite.html,
      text: invite.text
    };
  }


}

export default EmailService; 