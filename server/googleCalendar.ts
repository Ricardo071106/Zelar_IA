/**
 * Integração direta com Google Calendar
 * 
 * Este módulo permite adicionar eventos diretamente ao calendário do Google
 * sem necessidade de clicar em links
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { log } from './vite';

// Verificar credenciais do Google
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('Credenciais do Google não estão definidas no ambiente');
  console.warn('A integração direta com Google Calendar estará indisponível');
}

// Armazenar tokens de usuários
const userTokens = new Map<string, any>();

// Criar cliente OAuth2
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
);

// Escopos necessários para o Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'];

/**
 * Gera URL de autorização do Google
 */
export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    include_granted_scopes: true
  });
}

/**
 * Processa código de autorização e obtém tokens
 */
export async function getTokensFromCode(code: string): Promise<any> {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Erro ao obter tokens:', error);
    throw error;
  }
}

/**
 * Salva tokens de um usuário
 */
export function saveUserTokens(userId: string, tokens: any): void {
  userTokens.set(userId, tokens);
}

/**
 * Verifica se um usuário tem tokens salvos
 */
export function hasUserTokens(userId: string): boolean {
  return userTokens.has(userId);
}

/**
 * Adiciona evento diretamente ao Google Calendar
 */
export async function addEventToCalendar(
  userId: string,
  event: {
    title: string;
    description?: string;
    location?: string;
    startDate: Date;
    endDate?: Date;
  }
): Promise<boolean> {
  // Verificar se o usuário tem tokens
  if (!hasUserTokens(userId)) {
    return false;
  }
  
  try {
    // Configurar cliente com os tokens do usuário
    oauth2Client.setCredentials(userTokens.get(userId));
    
    // Criar cliente do Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Garantir que temos uma data de término
    const endDate = event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000);
    
    // Criar evento
    const googleEvent = {
      summary: event.title,
      location: event.location,
      description: event.description,
      start: {
        dateTime: event.startDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      reminders: {
        useDefault: true
      }
    };
    
    // Inserir evento
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: googleEvent
    });
    
    log(`Evento adicionado diretamente ao Google Calendar: ${response.data.htmlLink}`, 'google');
    
    return !!response.data.id;
  } catch (error) {
    console.error('Erro ao adicionar evento ao Google Calendar:', error);
    return false;
  }
}