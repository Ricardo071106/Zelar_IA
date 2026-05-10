import { addEventToGoogleCalendar, generateAuthUrl } from './googleCalendarIntegration';
import { storage } from '../storage';
import { log } from '../vite';
import { Event } from '@shared/schema';

/**
 * Tenta adicionar um evento ao Google Calendar de um usuário
 * @param event Evento a adicionar
 * @param userId ID do usuário
 * @returns Resultado da operação
 */
export async function syncEventWithGoogleCalendar(event: Event, userId: number): Promise<{
  success: boolean;
  message: string;
  requiresAuth?: boolean;
  authUrl?: string;
  conferenceLink?: string;
}> {
  try {
    // Verifica se o usuário existe
    const user = await storage.getUser(userId);
    if (!user) {
      return {
        success: false,
        message: 'Usuário não encontrado'
      };
    }

    // Verifica se o usuário tem configurações
    const settings = await storage.getUserSettings(userId);
    if (!settings) {
      // Usuário não tem configurações, precisa autenticar
      const authUrl = generateAuthUrl(userId);
      return {
        success: false,
        message: 'Você precisa autorizar o acesso ao Google Calendar primeiro',
        requiresAuth: true,
        authUrl
      };
    }

    // Verifica se o usuário tem tokens do Google
    if (!settings.googleTokens) {
      const authUrl = generateAuthUrl(userId);
      return {
        success: false,
        message: 'Você precisa autorizar o acesso ao Google Calendar primeiro',
        requiresAuth: true,
        authUrl
      };
    }

    // Tenta adicionar o evento ao Google Calendar
    const googleEvent = await addEventToGoogleCalendar(event, userId);
    
    if (!googleEvent.success) {
      // Verifica se é um problema de autenticação
      if (googleEvent.message.includes('autenticação') || googleEvent.message.includes('autorize')) {
        const authUrl = generateAuthUrl(userId);
        return {
          success: false,
          message: googleEvent.message,
          requiresAuth: true,
          authUrl
        };
      }
      
      return {
        success: false,
        message: googleEvent.message
      };
    }

    // Atualiza o evento com o ID do Google Calendar
    if (googleEvent.calendarEventId) {
      await storage.updateEvent(event.id, {
        calendarId: googleEvent.calendarEventId,
      });
    }

    return {
      success: true,
      message: 'Evento adicionado ao Google Calendar com sucesso',
      conferenceLink: googleEvent.conferenceLink,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao sincronizar evento com Google Calendar: ${errorMessage}`, 'google');
    
    return {
      success: false,
      message: `Erro ao sincronizar com Google Calendar: ${errorMessage}`,
    };
  }
}

/**
 * Verifica se o usuário tem autenticação com o Google Calendar
 * @param userId ID do usuário
 * @returns Status da autenticação e URL de autenticação se necessário
 */
export async function checkGoogleCalendarAuth(userId: number): Promise<{
  isAuthenticated: boolean;
  authUrl?: string;
  message: string;
}> {
  try {
    // Verifica se o usuário existe
    const user = await storage.getUser(userId);
    if (!user) {
      return {
        isAuthenticated: false,
        message: 'Usuário não encontrado'
      };
    }

    // Verifica se o usuário tem configurações
    const settings = await storage.getUserSettings(userId);
    if (!settings || !settings.googleTokens) {
      const authUrl = generateAuthUrl(userId);
      return {
        isAuthenticated: false,
        authUrl,
        message: 'Você precisa autorizar o acesso ao Google Calendar'
      };
    }

    return {
      isAuthenticated: true,
      message: 'Usuário autenticado com Google Calendar'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao verificar autenticação com Google Calendar: ${errorMessage}`, 'google');
    
    const authUrl = generateAuthUrl(userId);
    return {
      isAuthenticated: false,
      authUrl,
      message: `Erro ao verificar autenticação: ${errorMessage}`
    };
  }
}