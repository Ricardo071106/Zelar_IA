import { Event } from '@shared/schema';
import { storage } from '../storage';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:8080/api/auth/microsoft/callback';
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';

const AUTH_BASE_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0`;
const TOKEN_URL = `${AUTH_BASE_URL}/token`;
const AUTHORIZE_URL = `${AUTH_BASE_URL}/authorize`;
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['offline_access', 'User.Read', 'Calendars.ReadWrite'];

interface MicrosoftStoredTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  scope?: string;
}

function log(message: string): void {
  console.log(`${new Date().toISOString()} [MICROSOFT] ${message}`);
}

function detectConferenceIntent(event: Event): boolean {
  const fieldsToCheck = [event.description, event.location, event.title]
    .filter(Boolean)
    .map((field) => field!.toLowerCase());

  const triggers = [
    'video conferencia',
    'videoconferencia',
    'videoconferência',
    'microsoft teams',
    'teams',
    'video call',
    'videochamada',
    'video chamada',
    'conferencia em video',
    'conferência em vídeo',
    'reunião online',
    'reuniao online',
    'reunião virtual',
    'reuniao virtual',
    'call online',
    'call virtual',
  ];

  return fieldsToCheck.some((field) =>
    triggers.some((trigger) => {
      const normalizedTrigger = trigger.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalizedField = field.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normalizedField.includes(normalizedTrigger) || field.includes(trigger);
    }),
  );
}

function parseTokens(rawTokens?: string | null): MicrosoftStoredTokens | null {
  if (!rawTokens) return null;
  try {
    return JSON.parse(rawTokens) as MicrosoftStoredTokens;
  } catch {
    return null;
  }
}

function toStoredTokens(tokenData: MicrosoftStoredTokens): MicrosoftStoredTokens {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresIn = tokenData.expires_in ?? 0;
  return {
    ...tokenData,
    expires_at: tokenData.expires_at ?? nowInSeconds + expiresIn,
  };
}

function ensureMicrosoftConfig(): void {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error('MICROSOFT_CLIENT_ID e MICROSOFT_CLIENT_SECRET devem estar definidos');
  }
}

async function refreshAccessTokenIfNeeded(userId: number, tokens: MicrosoftStoredTokens): Promise<MicrosoftStoredTokens> {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (!tokens.expires_at || tokens.expires_at - 60 > nowInSeconds) {
    return tokens;
  }

  if (!tokens.refresh_token) {
    throw new Error('Refresh token não disponível. Reautentique o Microsoft Calendar.');
  }

  ensureMicrosoftConfig();

  const body = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID!,
    client_secret: MICROSOFT_CLIENT_SECRET!,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    redirect_uri: MICROSOFT_REDIRECT_URI,
    scope: SCOPES.join(' '),
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Falha ao renovar token Microsoft: ${response.status} ${errorData}`);
  }

  const refreshed = (await response.json()) as MicrosoftStoredTokens;
  const mergedTokens = toStoredTokens({
    ...tokens,
    ...refreshed,
    refresh_token: refreshed.refresh_token || tokens.refresh_token,
  });

  await storage.updateUserSettings(userId, {
    microsoftTokens: JSON.stringify(mergedTokens),
  });

  log(`Tokens Microsoft renovados para usuário ${userId}`);
  return mergedTokens;
}

async function getValidAccessToken(userId: number): Promise<string> {
  const settings = await storage.getUserSettings(userId);
  const tokens = parseTokens(settings?.microsoftTokens);

  if (!tokens?.access_token) {
    throw new Error('Usuário não autenticado com Microsoft Calendar');
  }

  const validTokens = await refreshAccessTokenIfNeeded(userId, tokens);
  if (!validTokens.access_token) {
    throw new Error('Token de acesso Microsoft inválido');
  }

  return validTokens.access_token;
}

export function generateMicrosoftAuthUrl(userId: number | string, platform: string = 'telegram'): string {
  ensureMicrosoftConfig();

  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state: JSON.stringify({ userId: String(userId), platform }),
    prompt: 'consent',
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeMicrosoftCodeForTokens(code: string): Promise<MicrosoftStoredTokens> {
  ensureMicrosoftConfig();

  const body = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID!,
    client_secret: MICROSOFT_CLIENT_SECRET!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: MICROSOFT_REDIRECT_URI,
    scope: SCOPES.join(' '),
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Falha ao trocar code por token Microsoft: ${response.status} ${errorData}`);
  }

  const tokenData = (await response.json()) as MicrosoftStoredTokens;
  return toStoredTokens(tokenData);
}

export async function addEventToMicrosoftCalendar(event: Event, userId: number): Promise<{
  success: boolean;
  message: string;
  calendarEventId?: string;
  conferenceLink?: string;
}> {
  try {
    const accessToken = await getValidAccessToken(userId);

    if (!event.startDate) {
      return { success: false, message: 'A data de início do evento é obrigatória' };
    }

    const startDate = new Date(event.startDate);
    if (Number.isNaN(startDate.getTime())) {
      return { success: false, message: 'A data de início do evento é inválida' };
    }

    let endDate: Date;
    if (event.endDate) {
      endDate = new Date(event.endDate);
      if (Number.isNaN(endDate.getTime())) {
        endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
      }
    } else {
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
    }

    let finalDescription = event.description || '';
    if (event.attendeePhones && event.attendeePhones.length > 0) {
      finalDescription += `\n\nContatos convidados: ${event.attendeePhones.join(', ')}`;
    }

    const attendees = (event.attendeeEmails || [])
      .filter((email) => Boolean(email && email.includes('@')))
      .map((email) => ({
        emailAddress: { address: email, name: email },
        type: 'required',
      }));

    const payload = {
      subject: event.title,
      body: {
        contentType: 'Text',
        content: finalDescription,
      },
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      location: event.location ? { displayName: event.location } : undefined,
      attendees: attendees.length > 0 ? attendees : undefined,
      isOnlineMeeting: detectConferenceIntent(event),
      onlineMeetingProvider: detectConferenceIntent(event) ? 'teamsForBusiness' : undefined,
    };

    const response = await fetch(`${GRAPH_BASE_URL}/me/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Falha ao criar evento no Microsoft Calendar: ${response.status} ${errorData}`);
    }

    const createdEvent = await response.json() as { id?: string; onlineMeeting?: { joinUrl?: string } };

    return {
      success: true,
      message: 'Evento adicionado ao Microsoft Calendar com sucesso',
      calendarEventId: createdEvent.id,
      conferenceLink: createdEvent.onlineMeeting?.joinUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao adicionar evento no Microsoft Calendar: ${errorMessage}`);
    return {
      success: false,
      message: `Erro ao adicionar evento ao Microsoft Calendar: ${errorMessage}`,
    };
  }
}

export async function cancelMicrosoftCalendarEvent(calendarEventId: string, userId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const accessToken = await getValidAccessToken(userId);

    const response = await fetch(`${GRAPH_BASE_URL}/me/events/${calendarEventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Falha ao cancelar evento no Microsoft Calendar: ${response.status} ${errorData}`);
    }

    return {
      success: true,
      message: 'Evento cancelado no Microsoft Calendar com sucesso',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao cancelar evento no Microsoft Calendar: ${errorMessage}`);
    return {
      success: false,
      message: `Erro ao cancelar evento no Microsoft Calendar: ${errorMessage}`,
    };
  }
}
