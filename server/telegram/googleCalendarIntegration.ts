import { calendar_v3, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Event } from '@shared/schema';

// Função auxiliar de log
function log(message: string, context?: string): void {
  const timestamp = new Date().toISOString();
  const prefix = context ? `[${context.toUpperCase()}]` : '';
  console.log(`${timestamp} ${prefix} ${message}`);
}

function detectConferenceIntent(event: Event): boolean {
  const fieldsToCheck = [event.description, event.location, event.title]
    .filter(Boolean)
    .map((field) => (field ? field.toLowerCase() : ''));

const conferenceTriggers = [
  'video conferencia',
  'videoconferencia',
  'videoconferência',
  'google meet',
  'meet',
  'video call',
  'videochamada',
  'video chamada',
  'call em video',
  'chamada em video',
  'chamada de video',
  'conferencia em video',
  'conferência em vídeo',
  'reunião online',
  'reuniao online',
  'reunião virtual',
  'reuniao virtual',
  'call online',
  'call virtual',
  'liga videoconferencia',
  'liga videoconferência',
];

  return fieldsToCheck.some((field) =>
    conferenceTriggers.some((trigger) => {
      // Remove acentos de forma mais compatível
      const normalizedTrigger = trigger.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalizedField = field.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normalizedField.includes(normalizedTrigger) || field.includes(trigger);
    })
  );
}

// Credenciais do Google OAuth
// Estas deveriam ser obtidas ao registrar o aplicativo no Google Cloud Console
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';

// Escopo para acesso ao Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Cache de clientes OAuth2 por usuário
const oauth2Clients = new Map<number, OAuth2Client>();

/**
 * Cria um cliente OAuth2 para um usuário
 * 
 * @param userId ID do usuário
 * @returns Cliente OAuth2
 */
function createOAuth2Client(userId: number): OAuth2Client {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem estar definidos');
  }
  
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
  
  oauth2Clients.set(userId, oauth2Client);
  return oauth2Client;
}

/**
 * Obtém o cliente OAuth2 para um usuário
 * 
 * @param userId ID do usuário
 * @returns Cliente OAuth2
 */
export function getOAuth2Client(userId: number): OAuth2Client {
  const existingClient = oauth2Clients.get(userId);
  if (existingClient) {
    return existingClient;
  }
  
  return createOAuth2Client(userId);
}

/**
 * Gera uma URL de autorização para o usuário conceder acesso ao seu calendário
 * 
 * @param userId ID do usuário
 * @returns URL de autorização
 */
export function generateAuthUrl(userId: number): string {
  const oauth2Client = getOAuth2Client(userId);
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    // Inclui o ID do usuário no estado para recuperá-lo no callback
    state: userId.toString(),
    // Solicita um novo refresh token mesmo que o usuário já tenha autorizado o app
    prompt: 'consent'
  });
  
  return authUrl;
}

/**
 * Processa o código de autorização e configura o cliente OAuth2
 * 
 * @param code Código de autorização
 * @param userId ID do usuário
 * @returns Tokens de acesso
 */
export async function handleAuthCode(code: string, userId: number): Promise<{
  success: boolean;
  message: string;
  tokens?: any;
}> {
  try {
    const oauth2Client = getOAuth2Client(userId);
    const { tokens } = await oauth2Client.getToken(code);
    
    oauth2Client.setCredentials(tokens);
    
    log(`Tokens OAuth recebidos para o usuário ${userId}`, 'google');
    
    return {
      success: true,
      message: 'Autenticação com Google Calendar concluída com sucesso',
      tokens
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao processar código de autenticação: ${errorMessage}`, 'google');
    
    return {
      success: false,
      message: `Erro ao autenticar com Google Calendar: ${errorMessage}`
    };
  }
}

/**
 * Configura o cliente OAuth2 com tokens existentes
 * 
 * @param userId ID do usuário
 * @param tokens Tokens de acesso
 * @returns Sucesso da operação
 */
export function setTokens(userId: number, tokens: any): boolean {
  try {
    const oauth2Client = getOAuth2Client(userId);
    oauth2Client.setCredentials(tokens);
    
    log(`Tokens OAuth configurados para o usuário ${userId}`, 'google');
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao configurar tokens: ${errorMessage}`, 'google');
    
    return false;
  }
}

/**
 * Adiciona um evento ao Google Calendar
 * 
 * @param event Evento a ser adicionado
 * @param userId ID do usuário
 * @returns Resultado da operação
 */
export async function addEventToGoogleCalendar(event: Event, userId: number): Promise<{
  success: boolean;
  message: string;
  calendarEventId?: string;
  conferenceLink?: string;
}> {
  try {
    const oauth2Client = getOAuth2Client(userId);
    
    // Verifica se temos tokens para este usuário
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      return {
        success: false,
        message: 'Usuário não autenticado com Google Calendar. Por favor, autorize o acesso primeiro.'
      };
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Verifica se temos datas válidas
    if (!event.startDate) {
      return {
        success: false,
        message: 'A data de início do evento é obrigatória'
      };
    }
    
    const startDate = new Date(event.startDate);
    if (isNaN(startDate.getTime())) {
      return {
        success: false,
        message: 'A data de início do evento é inválida'
      };
    }
    
    // Configura a data de término
    let endDate: Date;
    if (event.endDate) {
      endDate = new Date(event.endDate);
      if (isNaN(endDate.getTime())) {
        endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
      }
    } else {
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
    }
    
    // Cria o evento no Google Calendar
    const googleEvent: calendar_v3.Schema$Event = {
      summary: event.title,
      location: event.location || '',
      description: event.description || '',
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      reminders: {
        useDefault: true,
      },
    };

    if (detectConferenceIntent(event)) {
      googleEvent.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
          status: { statusCode: 'pending' }
        }
      };
    }
    
    // Insere o evento no calendário
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: googleEvent,
      conferenceDataVersion: googleEvent.conferenceData ? 1 : 0,
    });

    const meetLink = response.data.hangoutLink;
    if (meetLink) {
      event.location = meetLink;
    }

    log(`Evento adicionado ao Google Calendar: ${event.title}`, 'google');
    
    return {
      success: true,
      message: 'Evento adicionado ao Google Calendar com sucesso',
      calendarEventId: response.data.id || undefined,
      conferenceLink: meetLink || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao adicionar evento ao Google Calendar: ${errorMessage}`, 'google');
    
    // Verifica se é um erro de autenticação
    if (errorMessage.includes('invalid_grant') || errorMessage.includes('invalid_token')) {
      return {
        success: false,
        message: 'Autenticação expirada ou inválida. Por favor, autorize o acesso ao Google Calendar novamente.'
      };
    }
    
    return {
      success: false,
      message: `Erro ao adicionar evento ao Google Calendar: ${errorMessage}`
    };
  }
}

/**
 * Cancela um evento no Google Calendar
 * 
 * @param calendarEventId ID do evento no Google Calendar
 * @param userId ID do usuário
 * @returns Resultado da operação
 */
export async function cancelGoogleCalendarEvent(calendarEventId: string, userId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const oauth2Client = getOAuth2Client(userId);
    
    // Verifica se temos tokens para este usuário
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      return {
        success: false,
        message: 'Usuário não autenticado com Google Calendar. Por favor, autorize o acesso primeiro.'
      };
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Exclui o evento do calendário
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: calendarEventId,
    });
    
    log(`Evento cancelado no Google Calendar: ${calendarEventId}`, 'google');
    
    return {
      success: true,
      message: 'Evento cancelado no Google Calendar com sucesso'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao cancelar evento no Google Calendar: ${errorMessage}`, 'google');
    
    // Verifica se é um erro de autenticação
    if (errorMessage.includes('invalid_grant') || errorMessage.includes('invalid_token')) {
      return {
        success: false,
        message: 'Autenticação expirada ou inválida. Por favor, autorize o acesso ao Google Calendar novamente.'
      };
    }
    
    return {
      success: false,
      message: `Erro ao cancelar evento no Google Calendar: ${errorMessage}`
    };
  }
}

/**
 * Lista os próximos eventos do usuário
 * 
 * @param userId ID do usuário
 * @param maxResults Número máximo de eventos a retornar
 * @returns Lista de eventos
 */
export async function listUpcomingEvents(userId: number, maxResults = 10): Promise<{
  success: boolean;
  message: string;
  events?: any[];
}> {
  try {
    const oauth2Client = getOAuth2Client(userId);
    
    // Verifica se temos tokens para este usuário
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      return {
        success: false,
        message: 'Usuário não autenticado com Google Calendar. Por favor, autorize o acesso primeiro.'
      };
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Lista os próximos eventos
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items;
    
    if (!events || events.length === 0) {
      return {
        success: true,
        message: 'Nenhum evento próximo encontrado.',
        events: []
      };
    }
    
    log(`${events.length} eventos encontrados no Google Calendar para o usuário ${userId}`, 'google');
    
    return {
      success: true,
      message: `${events.length} eventos encontrados.`,
      events: events
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao listar eventos do Google Calendar: ${errorMessage}`, 'google');
    
    // Verifica se é um erro de autenticação
    if (errorMessage.includes('invalid_grant') || errorMessage.includes('invalid_token')) {
      return {
        success: false,
        message: 'Autenticação expirada ou inválida. Por favor, autorize o acesso ao Google Calendar novamente.'
      };
    }
    
    return {
      success: false,
      message: `Erro ao listar eventos do Google Calendar: ${errorMessage}`
    };
  }
}