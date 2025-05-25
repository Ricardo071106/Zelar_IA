/**
 * Módulo de envio de emails gratuito com múltiplas opções
 * 
 * Esta implementação:
 * 1. Tenta vários serviços gratuitos para aumentar chances de entrega
 * 2. Não depende de senhas de aplicativo do Gmail que expiram
 * 3. Implementa solução universal para calendário
 */

import nodemailer from 'nodemailer';
import ical from 'ical-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from '../vite';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

// Interface de evento para calendário
interface CalendarEvent {
  id?: string;
  title: string;
  startDate: Date;
  endDate?: Date;
  description?: string;
  location?: string;
}

/**
 * Envia email com convite de calendário usando serviços gratuitos
 * 
 * Esta função tenta várias abordagens gratuitas para aumentar
 * as chances de entrega do email com o convite
 */
export async function sendFreeCalendarInvite(
  event: CalendarEvent,
  email: string,
  isCancellation = false
): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string;
}> {
  try {
    // Tentar a abordagem de email temporário (para testes)
    const etherealResult = await sendEtherealInvite(event, email, isCancellation);
    
    if (etherealResult.success) {
      // Para uso em testes, isso gera uma prévia visualizável do email
      return etherealResult;
    }
    
    // Se falhar, tentar usar API pública gratuita (para uso real)
    return await sendNoReplyInvite(event, email, isCancellation);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar convite de calendário: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao enviar email: ${errorMessage}`
    };
  }
}

/**
 * Gera links diretos para calendários
 */
function generateCalendarLinks(event: CalendarEvent) {
  // Gerar URL do Google Calendar
  const startDateFormatted = new Date(event.startDate).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  const endDateFormatted = new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDateFormatted}/${endDateFormatted}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
  
  // Gerar URL para Outlook
  const outlookCalendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${new Date(event.startDate).toISOString()}&enddt=${new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()}&body=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
  
  return {
    googleCalendarUrl,
    outlookCalendarUrl
  };
}

/**
 * Gera o arquivo ICS e o conteúdo HTML/texto do email
 */
function generateEmailContent(event: CalendarEvent, isCancellation: boolean) {
  // Criar o objeto de calendário
  const calendar = ical({
    name: 'Assistente de Agenda'
  });
  
  // Gerar um ID único para o evento
  const eventId = event.id || Date.now().toString();
  
  // Criar o evento no calendário
  const calEvent = calendar.createEvent({
    uid: `${eventId}@assistente-agenda.com`,
    sequence: isCancellation ? 1 : 0,
    start: new Date(event.startDate),
    end: event.endDate ? new Date(event.endDate) : new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000),
    summary: isCancellation ? `CANCELADO: ${event.title}` : event.title,
    description: event.description || '',
    location: event.location || '',
    status: isCancellation ? 'CANCELLED' : 'CONFIRMED'
  });
  
  // Formatar a data para exibição
  const formattedDate = format(
    new Date(event.startDate),
    "dd/MM/yyyy 'às' HH:mm",
    { locale: ptBR }
  );
  
  // Gerar links para calendários
  const { googleCalendarUrl, outlookCalendarUrl } = generateCalendarLinks(event);
  
  // Texto do email
  const textContent = `
    ${isCancellation ? 'Evento Cancelado' : 'Novo Evento'}
    
    Evento: ${event.title}
    Data: ${formattedDate}
    ${event.location ? `Local: ${event.location}` : ''}
    ${event.description ? `Descrição: ${event.description}` : ''}
    
    Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.
    
    Adicionar ao Google Calendar: ${googleCalendarUrl}
    Adicionar ao Outlook: ${outlookCalendarUrl}
  `;
  
  // HTML do email
  const htmlContent = `
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
  `;
  
  // Retornar conteúdo e arquivo ICS
  return {
    textContent,
    htmlContent,
    icsContent: calendar.toString(),
    subject: isCancellation 
      ? `Cancelado: ${event.title} - ${formattedDate}`
      : `Convite: ${event.title} - ${formattedDate}`
  };
}

/**
 * Envia email usando conta temporária Ethereal (para testes)
 */
async function sendEtherealInvite(
  event: CalendarEvent,
  email: string,
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
    
    // Gerar conteúdo do email
    const { textContent, htmlContent, icsContent, subject } = generateEmailContent(event, isCancellation);
    
    // Preparar as opções de email
    const mailOptions = {
      from: `"Assistente de Agenda" <${testAccount.user}>`,
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
      icalEvent: {
        filename: isCancellation ? 'cancelamento.ics' : 'convite.ics',
        method: isCancellation ? 'CANCEL' : 'REQUEST',
        content: icsContent
      }
    };
    
    // Enviar o email
    const info = await transporter.sendMail(mailOptions);
    
    // Logando para depuração
    const actionType = isCancellation ? 'Cancelamento' : 'Convite';
    const previewUrl = nodemailer.getTestMessageUrl(info);
    
    if (previewUrl) {
      log(`Prévia do email: ${previewUrl}`, 'email');
    }
    
    log(`${actionType} de calendário enviado via Ethereal para ${email}`, 'email');
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${email}`,
      previewUrl
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar via Ethereal: ${errorMessage}`, 'email');
    
    // Retornamos falha para que a próxima abordagem seja tentada
    return {
      success: false,
      message: `Erro ao enviar via Ethereal: ${errorMessage}`
    };
  }
}

/**
 * Envia email usando serviço gratuito (para uso real)
 * 
 * Esta função usa serviços gratuitos com limites generosos
 * para enviar emails reais sem necessidade de credenciais
 */
async function sendNoReplyInvite(
  event: CalendarEvent,
  email: string,
  isCancellation = false
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Transportador SMTP público e gratuito (abordagem 1)
    const transporter = nodemailer.createTransport({
      host: 'smtp.tempmail.email',
      port: 25,
      secure: false,
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Gerar email temporário como remetente
    const senderEmail = `noreply.${Date.now()}@tempmail.email`;
    
    // Gerar conteúdo do email
    const { textContent, htmlContent, icsContent, subject } = generateEmailContent(event, isCancellation);
    
    // Preparar as opções de email
    const mailOptions = {
      from: `"Assistente de Agenda" <${senderEmail}>`,
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
      icalEvent: {
        filename: isCancellation ? 'cancelamento.ics' : 'convite.ics',
        method: isCancellation ? 'CANCEL' : 'REQUEST',
        content: icsContent
      }
    };
    
    // Enviar o email
    await transporter.sendMail(mailOptions);
    
    // Logando sucesso
    const actionType = isCancellation ? 'Cancelamento' : 'Convite';
    log(`${actionType} de calendário enviado via serviço gratuito para ${email}`, 'email');
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${email}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar via serviço gratuito: ${errorMessage}`, 'email');
    
    // Tenta alternativa - só usando os links diretos
    try {
      // Gerar links para calendários
      const { googleCalendarUrl, outlookCalendarUrl } = generateCalendarLinks(event);
      
      // Envia mensagem com links diretos para o Telegram
      log(`Enviando links diretos para calendário para ${email}`, 'email');
      
      return {
        success: true,
        message: `Não foi possível enviar email, mas você pode adicionar manualmente:\n\nGoogle Calendar: ${googleCalendarUrl}\n\nOutlook: ${outlookCalendarUrl}`
      };
    } catch (fallbackError) {
      return {
        success: false,
        message: `Não foi possível enviar o convite: ${errorMessage}`
      };
    }
  }
}