import nodemailer from 'nodemailer';
import { Event } from '@shared/schema';
import { log } from '../vite';
import * as ical from 'ical-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Configuração do transportador de e-mail gratuito
// Variáveis para armazenar as credenciais
let emailUser = '';
let emailPass = '';

// Criamos o transportador inicial vazio
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
 * Envia um convite de calendário por email
 * 
 * @param event O evento a ser enviado
 * @param email O email do destinatário
 * @returns Resultado da operação
 */
export async function sendCalendarInvite(event: Event, email: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Verifica se as credenciais foram configuradas
    if (!emailUser || !emailPass) {
      return {
        success: false,
        message: 'Credenciais de e-mail não configuradas. Utilize o comando /email para configurar.'
      };
    }

    // Criar calendário com evento
    const calendar = ical.default({ name: 'Zelar Calendário' });
    
    // Adicionar evento ao calendário
    const calEvent = calendar.createEvent({
      start: event.startDate,
      end: event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000), // 1 hora padrão se não tiver data de término
      summary: event.title,
      description: event.description || '',
      location: event.location || '',
      allDay: event.isAllDay || false
    });
    
    // Formatar data para o assunto do email
    const formattedDate = format(
      event.startDate,
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR }
    );
    
    // Configurar email
    const mailOptions = {
      from: `"Zelar Assistente" <${emailUser}>`,
      to: email,
      subject: `Convite: ${event.title} - ${formattedDate}`,
      text: `
        Evento: ${event.title}
        Data: ${formattedDate}
        ${event.location ? `Local: ${event.location}` : ''}
        ${event.description ? `Descrição: ${event.description}` : ''}
        
        Este é um convite de calendário enviado pelo Zelar Assistente.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="background-color: #0088cc; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">Convite para Evento</h2>
          </div>
          <div style="padding: 20px;">
            <h3 style="color: #333;">${event.title}</h3>
            <p style="color: #666;"><strong>Data:</strong> ${formattedDate}</p>
            ${event.location ? `<p style="color: #666;"><strong>Local:</strong> ${event.location}</p>` : ''}
            ${event.description ? `<p style="color: #666;"><strong>Descrição:</strong> ${event.description}</p>` : ''}
            <p style="margin-top: 30px; color: #888;">Este é um convite de calendário enviado pelo Zelar Assistente.</p>
          </div>
        </div>
      `,
      icalEvent: {
        filename: 'convite.ics',
        method: 'REQUEST',
        content: calendar.toString()
      }
    };
    
    // Enviar email
    await transporter.sendMail(mailOptions);
    
    log(`Convite de calendário enviado para ${email}`, 'email');
    
    return {
      success: true,
      message: `Convite de calendário enviado para ${email}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar convite de calendário: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao enviar convite de calendário: ${errorMessage}`
    };
  }
}

/**
 * Configura as credenciais do email do remetente
 * 
 * @param userEmail Email do remetente
 * @param userPass Senha do email ou senha de aplicativo
 * @returns Resultado da configuração
 */
export function configureEmailCredentials(userEmail: string, userPass: string): {
  success: boolean;
  message: string;
} {
  try {
    if (!userEmail || !userPass) {
      return {
        success: false,
        message: 'Email e senha são obrigatórios'
      };
    }
    
    // Atualiza as variáveis globais
    emailUser = userEmail;
    emailPass = userPass;
    
    // Recria o transportador com as novas credenciais
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
      message: `Erro ao configurar credenciais de email: ${errorMessage}`
    };
  }
}