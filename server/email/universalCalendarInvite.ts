/**
 * Módulo para envio de convites de calendário compatíveis com vários sistemas
 * 
 * Esta abordagem não depende de credenciais de email e oferece opções universais
 * para adicionar eventos ao calendário
 */
import nodemailer from 'nodemailer';
import ical from 'ical-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from '../vite';

/**
 * Envia um convite de calendário usando métodos universais
 * 
 * @param event Evento a ser enviado
 * @param userEmail Email do destinatário
 * @param isCancellation Se verdadeiro, marca o evento como cancelado
 */
export async function sendUniversalCalendarInvite(
  event: any,
  userEmail: string,
  isCancellation = false
): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string;
}> {
  try {
    // Criar conta temporária para testes
    const testAccount = await nodemailer.createTestAccount();
    log(`Conta de email temporária criada: ${testAccount.user}`, 'email');
    
    // Criar o transportador de email
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
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
    
    // Criar o evento no calendário com atributos específicos para compatibilidade universal
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
        email: testAccount.user
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
    
    // Gerar URL do Google Calendar
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${new Date(event.startDate).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15)}/${new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
    
    // Gerar URLs para outros calendários populares
    const outlookCalendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${new Date(event.startDate).toISOString()}&enddt=${new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()}&body=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
    
    // Preparar as opções de email
    const mailOptions = {
      from: `"Assistente de Agenda" <${testAccount.user}>`,
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
        
        Adicionar ao Google Calendar: ${googleCalendarUrl}
        Adicionar ao Outlook: ${outlookCalendarUrl}
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
            <p style="margin-top: 20px; color: #888;">Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.</p>
            
            <div style="margin-top: 25px; text-align: center;">
              <p style="margin-bottom: 15px; font-weight: bold;">Escolha como adicionar este evento ao seu calendário:</p>
              
              <!-- Google Calendar Button -->
              <table cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; margin-bottom: 10px;">
                <tr>
                  <td style="border-radius: 4px; background-color: #4CAF50;">
                    <a href="${googleCalendarUrl}" 
                       target="_blank" style="padding: 10px 20px; border-radius: 4px; color: #ffffff; text-decoration: none; display: inline-block; font-weight: bold;">
                      Adicionar ao Google Calendar
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Outlook Button -->
              <table cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; margin-bottom: 10px;">
                <tr>
                  <td style="border-radius: 4px; background-color: #0078D4;">
                    <a href="${outlookCalendarUrl}" 
                       target="_blank" style="padding: 10px 20px; border-radius: 4px; color: #ffffff; text-decoration: none; display: inline-block; font-weight: bold;">
                      Adicionar ao Outlook
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin-top: 15px; color: #888; font-size: 0.9em;">
                Ou abra o arquivo .ics anexado a este email para adicionar a outros aplicativos de calendário.
              </p>
            </div>
          </div>
        </div>
      `,
      icalEvent: {
        filename: isCancellation ? 'cancelamento.ics' : 'convite.ics',
        method: isCancellation ? 'CANCEL' : 'REQUEST',
        content: calendar.toString()
      },
      alternatives: [
        {
          contentType: 'text/calendar; charset=UTF-8; method=' + (isCancellation ? 'CANCEL' : 'REQUEST'),
          content: calendar.toString()
        }
      ]
    };
    
    // Enviar o email
    const info = await transporter.sendMail(mailOptions);
    
    // Logando para depuração
    const actionType = isCancellation ? 'Cancelamento' : 'Convite';
    const previewUrl = nodemailer.getTestMessageUrl(info);
    
    if (previewUrl) {
      log(`Prévia do email: ${previewUrl}`, 'email');
    }
    
    log(`${actionType} de calendário enviado para ${userEmail}`, 'email');
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${userEmail}`,
      previewUrl
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar convite de calendário: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao enviar email: ${errorMessage}`
    };
  }
}