/**
 * Bot WhatsApp usando Z-API (serviço brasileiro simples)
 * Muito mais fácil que Evolution API - só precisa se cadastrar no site
 */

import axios from 'axios';
import { parseEventWithClaude } from '../utils/claudeParser';
import { DateTime } from 'luxon';

interface ZAPIConfig {
  instanceId: string;
  token: string;
  phone: string; // Seu número
}

interface WhatsAppMessage {
  phone: string;
  fromMe: boolean;
  message: {
    text?: string;
  };
  senderName: string;
}

interface Event {
  title: string;
  startDate: string;
  description: string;
  displayDate: string;
}

let zapiConfig: ZAPIConfig | null = null;

/**
 * Configura Z-API (muito mais simples que Evolution)
 */
export function setupZAPI(instanceId: string, token: string, phone: string): boolean {
  try {
    zapiConfig = {
      instanceId,
      token,
      phone
    };
    
    console.log(`📱 Z-API configurado para número: ${phone}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao configurar Z-API:', error);
    return false;
  }
}

/**
 * Envia mensagem via Z-API
 */
async function sendZAPIMessage(phone: string, message: string): Promise<boolean> {
  if (!zapiConfig) {
    console.error('❌ Z-API não configurado');
    return false;
  }

  try {
    const response = await axios.post(
      `https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/send-text`,
      {
        phone: phone,
        message: message
      }
    );

    console.log(`✅ Mensagem Z-API enviada para ${phone}`);
    return response.status === 200;
  } catch (error) {
    console.error('❌ Erro ao enviar via Z-API:', error);
    return false;
  }
}

/**
 * Extrai título limpo do evento
 */
function extractEventTitle(text: string): string {
  let cleanTitle = text.toLowerCase();
  
  const patterns = [
    /\b(me\s+lembre\s+de|lembre\s+me\s+de|me\s+lembrar\s+de)\b/gi,
    /\b(marque|agende|coloque|anote|lembre|crie|faça|criar|fazer)\b/gi,
    /\b(às|as)\s+\d{1,2}(:\d{2})?\s?(h|horas?|pm|am)?\b/gi,
    /\b(amanhã|hoje|ontem|segunda|terça|quarta|quinta|sexta|sábado|domingo)(-feira)?\b/gi,
    /\b(da\s+manhã|da\s+tarde|da\s+noite|de\s+manhã|de\s+tarde|de\s+noite)\b/gi,
    /\b(daqui|em)\s+\d+\s+(dias?|semanas?|meses?)\b/gi,
  ];

  patterns.forEach(pattern => {
    cleanTitle = cleanTitle.replace(pattern, ' ');
  });

  cleanTitle = cleanTitle
    .replace(/\s+/g, ' ')
    .replace(/^\s*(o|a|os|as|um|uma|no|na|em|de|da|do|às|as)\s+/i, '')
    .trim();

  return cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
}

/**
 * Gera links para calendários
 */
function generateCalendarLinks(event: Event) {
  const eventDateTime = DateTime.fromISO(event.startDate);
  const endDateTime = eventDateTime.plus({ hours: 1 });
  
  const startUTC = eventDateTime.toUTC();
  const endUTC = endDateTime.toUTC();
  const startFormatted = startUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
  const endFormatted = endUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
  
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startFormatted}/${endFormatted}`;
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${eventDateTime.toISO()}&enddt=${endDateTime.toISO()}`;
  
  return { googleLink, outlookLink };
}

/**
 * Processa mensagem usando Claude + fallback local
 */
async function processEventMessage(text: string): Promise<Event | null> {
  try {
    console.log(`🔍 Processando Z-API: "${text}"`);
    
    const userTimezone = 'America/Sao_Paulo';
    
    try {
      const claudeResult = await parseEventWithClaude(text, userTimezone);
      if (claudeResult.isValid) {
        console.log('🤖 Claude interpretou com sucesso');
        
        const eventDateTime = DateTime.fromISO(claudeResult.date).setZone(userTimezone);
        
        return {
          title: claudeResult.title,
          startDate: eventDateTime.toISO()!,
          description: `Evento criado via WhatsApp`,
          displayDate: eventDateTime.toFormat('dd/MM/yyyy HH:mm')
        };
      }
    } catch (error) {
      console.log('❌ Claude falhou, usando fallback');
    }

    // Fallback local
    const title = extractEventTitle(text);
    const now = DateTime.now().setZone(userTimezone);
    let targetDate = now.plus({ hours: 1 });

    if (text.includes('amanhã')) {
      targetDate = now.plus({ days: 1 }).set({ hour: 9, minute: 0 });
    }

    return {
      title,
      startDate: targetDate.toISO()!,
      description: `Evento criado via WhatsApp`,
      displayDate: targetDate.toFormat('dd/MM/yyyy HH:mm')
    };

  } catch (error) {
    console.error('❌ Erro ao processar:', error);
    return null;
  }
}

/**
 * Processa mensagens recebidas via webhook Z-API
 */
export async function processZAPIMessage(messageData: any): Promise<void> {
  try {
    // Ignorar mensagens próprias
    if (messageData.fromMe) return;

    const messageText = messageData.text?.message || '';
    if (!messageText.trim()) return;

    const phone = messageData.phone;
    const userName = messageData.senderName || 'Usuário';

    console.log(`📱 Mensagem Z-API de ${userName} (${phone}): ${messageText}`);

    // Comando iniciar
    if (messageText.toLowerCase().includes('iniciar') || messageText.toLowerCase().includes('começar')) {
      const welcomeMessage = 
        `🤖 *Zelar - Assistente de Agendamentos*\n\n` +
        `Olá ${userName}! Sou seu assistente para criar eventos automaticamente!\n\n` +
        `📝 *Exemplos que entendo:*\n` +
        `• "me lembre de ligar para João amanhã às 15h"\n` +
        `• "reunião com cliente sexta às 10"\n` +
        `• "consulta médica daqui 3 dias às 14:30"\n\n` +
        `✅ Vou criar links diretos para seus calendários!`;

      await sendZAPIMessage(phone, welcomeMessage);
      return;
    }

    // Processar como evento
    const event = await processEventMessage(messageText);
    
    if (event) {
      const { googleLink, outlookLink } = generateCalendarLinks(event);
      
      const responseMessage = 
        `✅ *Evento criado!*\n\n` +
        `🎯 *${event.title}*\n` +
        `📅 ${event.displayDate}\n\n` +
        `📅 *Adicionar ao calendário:*\n` +
        `🔗 Google: ${googleLink}\n\n` +
        `🔗 Outlook: ${outlookLink}`;

      await sendZAPIMessage(phone, responseMessage);
    } else {
      const helpMessage = 
        `❌ *Não consegui entender essa data/hora*\n\n` +
        `📝 *Você disse:* "${messageText}"\n\n` +
        `💡 *Tente algo como:*\n` +
        `• "me lembre de pagar conta amanhã às 15h"\n` +
        `• "reunião hoje às 10"\n` +
        `• "consulta sexta às 14:30"`;

      await sendZAPIMessage(phone, helpMessage);
    }

  } catch (error) {
    console.error('❌ Erro ao processar Z-API:', error);
  }
}

/**
 * Verifica se Z-API está funcionando
 */
export async function checkZAPIStatus(): Promise<{ connected: boolean, message: string }> {
  if (!zapiConfig) {
    return { connected: false, message: 'Z-API não configurado' };
  }

  try {
    const response = await axios.get(
      `https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/status`
    );

    const isConnected = response.data?.connected === true;
    
    return { 
      connected: isConnected, 
      message: isConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado' 
    };
  } catch (error) {
    return { connected: false, message: 'Erro ao verificar status' };
  }
}

/**
 * Conecta o WhatsApp (gera QR Code)
 */
export async function connectZAPI(): Promise<{ success: boolean, qrCode?: string, message: string }> {
  if (!zapiConfig) {
    return { success: false, message: 'Z-API não configurado' };
  }

  try {
    // URLs possíveis para diferentes versões do Z-API
    const possibleUrls = [
      `https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/qr-code`,
      `https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/qrcode`,
      `https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/connect`,
      `https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/status`
    ];

    let lastError: any = null;

    // Tenta diferentes endpoints
    for (const url of possibleUrls) {
      try {
        console.log(`Tentando URL: ${url}`);
        
        const response = await axios.get(url, {
          timeout: 10000,
          params: url.includes('qr') ? { image: true } : {}
        });

        console.log(`Resposta da API:`, response.data);

        // Verifica diferentes formatos de resposta
        const qrCode = response.data?.qrcode || 
                      response.data?.qr_code || 
                      response.data?.value || 
                      response.data?.base64 ||
                      response.data?.image;

        if (qrCode) {
          return {
            success: true,
            qrCode: qrCode,
            message: 'QR Code gerado com sucesso'
          };
        }

        // Se chegou até aqui mas não tem QR, pode ser status
        if (response.data?.connected === false) {
          // Tenta forçar desconexão e reconexão
          try {
            await axios.post(`https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/disconnect`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const qrResponse = await axios.get(`https://api.z-api.io/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/qr-code`);
            const newQrCode = qrResponse.data?.qrcode || qrResponse.data?.value;
            
            if (newQrCode) {
              return {
                success: true,
                qrCode: newQrCode,
                message: 'QR Code gerado após desconexão'
              };
            }
          } catch (disconnectError) {
            console.log('Erro ao tentar desconectar:', disconnectError);
          }
        }

      } catch (error: any) {
        lastError = error;
        console.log(`❌ Erro na URL ${url}:`);
        console.log(`   Status: ${error.response?.status}`);
        console.log(`   Data: ${JSON.stringify(error.response?.data)}`);
        console.log(`   Message: ${error.message}`);
        continue;
      }
    }

    // Se chegou aqui, nenhuma URL funcionou
    return {
      success: false,
      message: `Erro ao gerar QR Code. Verifique se Instance ID (${zapiConfig.instanceId}) e Token estão corretos no painel Z-API. Erro: ${lastError?.response?.data?.message || lastError?.message || 'Desconhecido'}`
    };

  } catch (error: any) {
    console.error('Erro detalhado Z-API:', error.response?.data || error.message);
    return {
      success: false,
      message: `Erro ao conectar Z-API: ${error.response?.data?.message || error.message}`
    };
  }
}