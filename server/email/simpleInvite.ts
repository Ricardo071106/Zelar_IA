import nodemailer from 'nodemailer';
import { Event } from '@shared/schema';
import { log } from '../vite';
import ical from 'ical-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Configuração do email
let emailConfig = {
  user: '',
  pass: ''
};

// Função simplificada para enviar convites de calendário
export async function sendInvite(
  event: Event, 
  email: string, 
  isCancelled = false
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Verifica se as credenciais foram configuradas
    if (!emailConfig.user || !emailConfig.pass) {
      return {
        success: false,
        message: 'Email não configurado. Peça ao administrador para configurar com /configurar_email'
      };
    }
    
    // Cria um transportador
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass
      }
    });
    
    // Cria um calendário
    const calendar = ical({
      name: 'Zelar Calendário'
    });
    
    // Adiciona o evento ao calendário
    const calEvent = calendar.createEvent({
      start: event.startDate,
      end: event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000),
      summary: isCancelled ? `CANCELADO: ${event.title}` : event.title,
      description: event.description || '',
      location: event.location || ''
    });
    
    // Formata a data para exibição
    const formattedDate = format(
      event.startDate,
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR }
    );
    
    // Configura o email
    const mailOptions = {
      from: `"Zelar Assistente" <${emailConfig.user}>`,
      to: email,
      subject: isCancelled 
        ? `Cancelado: ${event.title} - ${formattedDate}`
        : `Convite: ${event.title} - ${formattedDate}`,
      text: `
        ${isCancelled ? 'Evento Cancelado' : 'Novo Evento'}
        
        Evento: ${event.title}
        Data: ${formattedDate}
        ${event.location ? `Local: ${event.location}` : ''}
        ${event.description ? `Descrição: ${event.description}` : ''}
        
        Este ${isCancelled ? 'cancelamento' : 'convite'} foi enviado pelo Zelar Assistente.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="background-color: ${isCancelled ? '#ff6b6b' : '#0088cc'}; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">${isCancelled ? 'Evento Cancelado' : 'Convite para Evento'}</h2>
          </div>
          <div style="padding: 20px;">
            <h3 style="color: #333;">${isCancelled ? `CANCELADO: ${event.title}` : event.title}</h3>
            <p style="color: #666;"><strong>Data:</strong> ${formattedDate}</p>
            ${event.location ? `<p style="color: #666;"><strong>Local:</strong> ${event.location}</p>` : ''}
            ${event.description ? `<p style="color: #666;"><strong>Descrição:</strong> ${event.description}</p>` : ''}
            <p style="margin-top: 30px; color: #888;">Este ${isCancelled ? 'cancelamento' : 'convite'} foi enviado pelo Zelar Assistente.</p>
          </div>
        </div>
      `,
      icalEvent: {
        filename: isCancelled ? 'cancelamento.ics' : 'convite.ics',
        method: isCancelled ? 'CANCEL' : 'REQUEST',
        content: calendar.toString()
      }
    };
    
    // Envia o email
    await transporter.sendMail(mailOptions);
    
    const actionType = isCancelled ? 'Cancelamento' : 'Convite';
    log(`${actionType} de calendário enviado para ${email}`, 'email');
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${email}`
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

// Configura as credenciais de email
export function configureEmail(user: string, pass: string): {
  success: boolean;
  message: string;
} {
  try {
    if (!user || !pass) {
      return {
        success: false,
        message: 'Email e senha são obrigatórios'
      };
    }
    
    emailConfig = { user, pass };
    
    log(`Credenciais de email configuradas para ${user}`, 'email');
    
    return {
      success: true,
      message: `Credenciais de email configuradas para ${user}`
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