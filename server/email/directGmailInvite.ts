/**
 * Módulo para envio direto de convites de calendário via Gmail
 * 
 * Este método é mais confiável para integração com Google Calendar
 */
import nodemailer from 'nodemailer';
import ical from 'ical-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from '../vite';

// Configuração do email
let emailConfig = {
  user: '',
  pass: ''
};

/**
 * Configurar as credenciais do email do remetente
 * 
 * @param user Email do remetente
 * @param pass Senha ou senha de aplicativo
 */
export function setupEmailCredentials(user: string, pass: string): boolean {
  try {
    emailConfig.user = user;
    emailConfig.pass = pass;
    log(`Credenciais de email configuradas: ${user}`, 'email');
    return true;
  } catch (error) {
    log(`Erro ao configurar credenciais de email: ${error}`, 'email');
    return false;
  }
}

/**
 * Envia um convite de calendário diretamente usando Gmail
 * 
 * @param event Evento a ser enviado
 * @param userEmail Email do destinatário
 * @param isCancellation Se verdadeiro, marca o evento como cancelado
 */
export async function sendGmailCalendarInvite(
  event: any,
  userEmail: string,
  isCancellation = false
): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string;
}> {
  try {
    // Verificar se temos credenciais configuradas
    if (!emailConfig.user || !emailConfig.pass) {
      return {
        success: false,
        message: 'Credenciais de email não configuradas. Use /configurar_email para configurar.'
      };
    }
    
    // Criar o transportador de email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass
      }
    });
    
    // Criar o objeto de calendário
    const calendar = ical({
      name: 'Assistente de Agenda',
      timezone: 'America/Sao_Paulo'
    });
    
    // Definir o método do calendário
    calendar.method(isCancellation ? 'CANCEL' as any : 'REQUEST' as any);
    
    // Gerar um ID único para o evento
    const eventId = event.id || Date.now().toString();
    // Criar o UID completo para o evento
    const eventUid = `${eventId}@assistente-agenda.com`;
    
    // Criar o evento no calendário com atributos específicos para Google Calendar
    const calEvent = calendar.createEvent({
      uid: eventUid,
      sequence: isCancellation ? 1 : 0,
      start: new Date(event.startDate),
      end: event.endDate ? new Date(event.endDate) : new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000),
      summary: isCancellation ? `CANCELADO: ${event.title}` : event.title,
      description: event.description || '',
      location: event.location || '',
      organizer: {
        name: 'Assistente de Agenda',
        email: emailConfig.user
      },
      attendees: [
        {
          name: userEmail.split('@')[0],
          email: userEmail,
          rsvp: true
        }
      ]
    });
    
    // Se for cancelamento, marque o evento como cancelado
    if (isCancellation) {
      calEvent.status('CANCELLED' as any);
    }
    
    // Formatar a data para exibição
    const formattedDate = format(
      new Date(event.startDate),
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR }
    );
    
    // Preparar as opções de email
    const mailOptions = {
      from: `"Assistente de Agenda" <${emailConfig.user}>`,
      to: userEmail,
      subject: isCancellation 
        ? `Cancelado: ${event.title} - ${formattedDate}`
        : `Convite: ${event.title} - ${formattedDate}`,
      text: `
        ${isCancellation ? 'Evento Cancelado' : 'Novo Evento'}
        
        Evento: ${event.title}
        Data: ${formattedDate}
        ${event.location ? `Local: ${event.location}` : ''}
        ${event.description ? `Descrição: ${event.description}` : ''}
        
        Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="background-color: ${isCancellation ? '#ff6b6b' : '#0088cc'}; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">${isCancellation ? 'Evento Cancelado' : 'Convite para Evento'}</h2>
          </div>
          <div style="padding: 20px;">
            <h3 style="color: #333;">${isCancellation ? `CANCELADO: ${event.title}` : event.title}</h3>
            <p style="color: #666;"><strong>Data:</strong> ${formattedDate}</p>
            ${event.location ? `<p style="color: #666;"><strong>Local:</strong> ${event.location}</p>` : ''}
            ${event.description ? `<p style="color: #666;"><strong>Descrição:</strong> ${event.description}</p>` : ''}
            <p style="margin-top: 30px; color: #888;">Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.</p>
          </div>
        </div>
      `,
      headers: {
        'Content-Class': 'urn:content-classes:calendarmessage',
        'Content-ID': `<calendar_message_${eventId}@assistente-agenda.com>`,
        'Content-Type': 'text/calendar; charset=UTF-8; method=' + (isCancellation ? 'CANCEL' : 'REQUEST'),
        'X-Mailer': 'Microsoft Office Outlook 12.0',  // Ajuda em algumas compatibilidades
        'X-MS-OLK-FORCEINSPECTOROPEN': 'TRUE'         // Força abrir como convite no Outlook
      },
      alternatives: [
        {
          contentType: 'text/calendar; charset=UTF-8; method=' + (isCancellation ? 'CANCEL' : 'REQUEST'),
          content: calendar.toString()
        }
      ],
      icalEvent: {
        filename: isCancellation ? 'cancelamento.ics' : 'convite.ics',
        method: isCancellation ? 'CANCEL' : 'REQUEST',
        content: calendar.toString()
      }
    };
    
    // Enviar o email
    await transporter.sendMail(mailOptions);
    
    const actionType = isCancellation ? 'Cancelamento' : 'Convite';
    log(`${actionType} de calendário enviado para ${userEmail} via Gmail`, 'email');
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${userEmail} via Gmail`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar convite de calendário via Gmail: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao enviar email via Gmail: ${errorMessage}`
    };
  }
}

// Exportar a configuração de email para outros módulos
export { emailConfig };