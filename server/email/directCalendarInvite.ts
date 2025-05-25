/**
 * Módulo para envio direto de convites de calendário via email
 * Esta é a maneira recomendada para integração com calendários, evitando
 * problemas com arquivos ICS e garantindo que eventos apareçam automaticamente
 * nos calendários dos usuários.
 */

import nodemailer from 'nodemailer';
import { Event } from '@shared/schema';
import { log } from '../vite';
import * as ical from 'ical-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Configuração do email
let emailUser = '';
let emailPass = '';

// Transporter padrão (será configurado quando o usuário definir as credenciais)
let transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: emailUser,
    pass: emailPass
  }
});

/**
 * Envia um convite de calendário direto para o email do usuário
 * Este método é preferível para integração com calendários pois os convites
 * aparecerão automaticamente nos aplicativos de calendário do usuário
 * 
 * @param event Evento a ser enviado
 * @param userEmail Email do destinatário
 * @param isCancellation Se verdadeiro, marca o evento como cancelado
 * @returns Resultado da operação
 */
export async function sendCalendarInviteDirectly(
  event: Event, 
  userEmail: string,
  isCancellation = false
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Verifica se o email está configurado
    if (!emailUser || !emailPass) {
      return {
        success: false,
        message: 'Credenciais de email não configuradas. O administrador deve configurar usando /configurar_email.'
      };
    }

    // Cria um novo calendário
    const calendar = ical.default({ name: 'Zelar Calendário' });
    
    // Define o título apropriado baseado no status do evento
    const title = isCancellation ? `CANCELADO: ${event.title}` : event.title;
    
    // Adiciona o evento ao calendário
    const calEvent = calendar.createEvent({
      start: event.startDate,
      end: event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000), // 1h padrão
      summary: title,
      description: event.description || '',
      location: event.location || '',
      // Status do evento definido como string para evitar erros de tipo
      // status: isCancellation ? 'CANCELLED' : 'CONFIRMED',
      allDay: event.isAllDay || false
    });
    
    // Formata a data para o assunto do email
    const formattedDate = format(
      event.startDate,
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR }
    );
    
    // Define o método apropriado baseado no status do evento
    const method = isCancellation ? 'CANCEL' : 'REQUEST';
    
    // Configura o email
    const mailOptions = {
      from: `"Zelar Assistente" <${emailUser}>`,
      to: userEmail,
      subject: isCancellation
        ? `Cancelado: ${event.title} - ${formattedDate}`
        : `Convite: ${event.title} - ${formattedDate}`,
      text: `
        ${isCancellation ? 'Evento Cancelado' : 'Novo Evento'}
        
        Evento: ${title}
        Data: ${formattedDate}
        ${event.location ? `Local: ${event.location}` : ''}
        ${event.description ? `Descrição: ${event.description}` : ''}
        
        Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Zelar Assistente.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="background-color: ${isCancellation ? '#ff6b6b' : '#0088cc'}; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">${isCancellation ? 'Evento Cancelado' : 'Convite para Evento'}</h2>
          </div>
          <div style="padding: 20px;">
            <h3 style="color: #333;">${title}</h3>
            <p style="color: #666;"><strong>Data:</strong> ${formattedDate}</p>
            ${event.location ? `<p style="color: #666;"><strong>Local:</strong> ${event.location}</p>` : ''}
            ${event.description ? `<p style="color: #666;"><strong>Descrição:</strong> ${event.description}</p>` : ''}
            <p style="margin-top: 30px; color: #888;">Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Zelar Assistente.</p>
          </div>
        </div>
      `,
      icalEvent: {
        filename: isCancellation ? 'cancelamento.ics' : 'convite.ics',
        method: method,
        content: calendar.toString()
      }
    };
    
    // Envia o email
    await transporter.sendMail(mailOptions);
    
    const actionType = isCancellation ? 'Cancelamento' : 'Convite';
    log(`${actionType} de calendário enviado para ${userEmail}`, 'email');
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${userEmail}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar convite/cancelamento de calendário: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao enviar email: ${errorMessage}`
    };
  }
}

/**
 * Configura as credenciais do email do remetente
 * 
 * @param newEmailUser Email do remetente
 * @param newEmailPass Senha do email
 * @returns Resultado da configuração
 */
export function setupEmailCredentials(
  newEmailUser: string, 
  newEmailPass: string
): {
  success: boolean;
  message: string;
} {
  try {
    if (!newEmailUser || !newEmailPass) {
      return {
        success: false,
        message: 'Email e senha são obrigatórios'
      };
    }
    
    // Atualiza as variáveis globais
    emailUser = newEmailUser;
    emailPass = newEmailPass;
    
    // Recria o transportador
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
    
    log(`Credenciais de email configuradas para ${emailUser}`, 'email');
    
    return {
      success: true,
      message: `Credenciais de email configuradas para ${emailUser}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao configurar credenciais de email: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao configurar credenciais: ${errorMessage}`
    };
  }
}