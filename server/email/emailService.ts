import { sendCalendarInvite, configureEmailCredentials } from './calendarEmail';
import { Event } from '@shared/schema';
import { log } from '../vite';

/**
 * Envia um convite de calendário por email para o usuário
 * 
 * @param event Evento para enviar convite
 * @param email Email do destinatário
 * @returns Resultado da operação
 */
export async function sendEventInvite(event: Event, email: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Enviar convite de calendário
    const result = await sendCalendarInvite(event, email);
    
    if (result.success) {
      log(`Convite para evento ${event.title} enviado para ${email}`, 'email');
    } else {
      log(`Falha ao enviar convite para evento ${event.title}: ${result.message}`, 'email');
    }
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao processar envio de convite: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao enviar convite de calendário: ${errorMessage}`
    };
  }
}

/**
 * Configura credenciais do email do remetente
 * 
 * @param emailUser Email do remetente
 * @param emailPass Senha do email
 * @returns Resultado da configuração
 */
export function setupEmailCredentials(emailUser: string, emailPass: string): {
  success: boolean;
  message: string;
} {
  return configureEmailCredentials(emailUser, emailPass);
}