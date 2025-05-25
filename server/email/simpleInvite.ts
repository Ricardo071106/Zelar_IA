import nodemailer from 'nodemailer';
import { Event } from '@shared/schema';
import { log } from '../vite';
import ical from 'ical-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Configuração do email
let emailConfig = {
  user: '',
  pass: '',
  service: 'gmail' // Pode ser 'outlook', 'yahoo', etc.
};

// Função para criar um transportador de email temporário
async function createTransporter() {
  // Se temos configurações existentes, use-as
  if (emailConfig.user && emailConfig.pass) {
    // Transportadores para serviços comuns
    if (emailConfig.service === 'gmail') {
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass
        }
      });
    } else if (emailConfig.service === 'outlook') {
      return nodemailer.createTransport({
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass
        }
      });
    } else if (emailConfig.service === 'yahoo') {
      return nodemailer.createTransport({
        host: 'smtp.mail.yahoo.com',
        port: 587,
        secure: false,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass
        }
      });
    }
  }
  
  // Se não temos configurações existentes, cria uma conta temporária
  // usando Ethereal Email (serviço de testes do Nodemailer)
  try {
    const testAccount = await nodemailer.createTestAccount();
    log(`Conta de email temporária criada: ${testAccount.user}`, 'email');
    
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  } catch (error) {
    log(`Erro ao criar conta temporária: ${error}`, 'email');
    throw error;
  }
}

// Função simplificada para enviar convites de calendário
export async function sendInvite(
  event: Event, 
  email: string, 
  isCancelled = false
): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string; // URL para visualizar o email (só para contas temporárias)
}> {
  try {
    // Cria um transportador (usando conta configurada ou temporária)
    const transporter = await createTransporter();
    
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
    
    // Determina o remetente do email
    const sender = emailConfig.user 
      ? `"Zelar Assistente" <${emailConfig.user}>`
      : `"Zelar Assistente" <no-reply@zelarassistente.com>`;
    
    // Configura o email
    const mailOptions = {
      from: sender,
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
    const info = await transporter.sendMail(mailOptions);
    
    const actionType = isCancelled ? 'Cancelamento' : 'Convite';
    log(`${actionType} de calendário enviado para ${email}`, 'email');
    
    // Se estamos usando uma conta temporária, inclui a URL de visualização
    let previewUrl;
    if (info.messageId && !emailConfig.user) {
      const testMessageUrl = nodemailer.getTestMessageUrl(info);
      previewUrl = typeof testMessageUrl === 'string' ? testMessageUrl : undefined;
      if (previewUrl) {
        log(`Prévia do email: ${previewUrl}`, 'email');
      }
    }
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${email}`,
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

// Configura as credenciais de email
export function configureEmail(user: string, pass: string, service = 'gmail'): {
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
    
    emailConfig = { user, pass, service };
    
    log(`Credenciais de email configuradas para ${user} (${service})`, 'email');
    
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