/**
 * WhatsApp Bot usando Evolution API
 * 
 * Evolution API é uma solução simples e direta para WhatsApp Business
 * que não depende de GitHub ou configurações complexas
 */

import axios from 'axios';

interface EvolutionConfig {
  baseUrl: string;
  instanceName: string;
  apiKey: string;
}

let config: EvolutionConfig | null = null;

/**
 * Configura a Evolution API com suas credenciais
 */
export function setupEvolutionAPI(baseUrl: string, instanceName: string, apiKey: string): boolean {
  try {
    // Remove barras extras da URL
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    
    config = {
      baseUrl: cleanBaseUrl,
      instanceName: instanceName.trim(),
      apiKey: apiKey.trim()
    };
    
    console.log('✅ Evolution API configurada:', { baseUrl: cleanBaseUrl, instanceName });
    return true;
  } catch (error) {
    console.error('❌ Erro ao configurar Evolution API:', error);
    return false;
  }
}

/**
 * Verifica se a Evolution API está configurada
 */
export function isConfigured(): boolean {
  return config !== null;
}

/**
 * Obtém a configuração atual
 */
export function getConfig(): EvolutionConfig | null {
  return config;
}

/**
 * Cria uma nova instância do WhatsApp
 */
export async function createInstance(): Promise<{ success: boolean, message: string, data?: any }> {
  if (!config) {
    return { success: false, message: 'Evolution API não configurada' };
  }

  try {
    const response = await axios.post(
      `${config.baseUrl}/instance/create`,
      {
        instanceName: config.instanceName,
        integration: 'WHATSAPP-BAILEYS'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey
        },
        timeout: 30000
      }
    );

    if (response.status === 201 || response.status === 200) {
      console.log('✅ Instância criada com sucesso');
      return { 
        success: true, 
        message: 'Instância criada com sucesso',
        data: response.data
      };
    } else {
      return { 
        success: false, 
        message: `Erro ao criar instância: ${response.statusText}` 
      };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido';
    console.error('❌ Erro ao criar instância:', errorMsg);
    return { 
      success: false, 
      message: `Erro ao criar instância: ${errorMsg}` 
    };
  }
}

/**
 * Conecta a instância e gera QR Code
 */
export async function connectInstance(): Promise<{ success: boolean, message: string, qrCode?: string }> {
  if (!config) {
    return { success: false, message: 'Evolution API não configurada' };
  }

  try {
    const response = await axios.get(
      `${config.baseUrl}/instance/connect/${config.instanceName}`,
      {
        headers: {
          'apikey': config.apiKey
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.base64) {
      console.log('✅ QR Code gerado com sucesso');
      return { 
        success: true, 
        message: 'QR Code gerado com sucesso',
        qrCode: `data:image/png;base64,${response.data.base64}`
      };
    } else {
      return { 
        success: false, 
        message: 'QR Code não encontrado na resposta' 
      };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido';
    console.error('❌ Erro ao conectar instância:', errorMsg);
    return { 
      success: false, 
      message: `Erro ao conectar: ${errorMsg}`
    };
  }
}

/**
 * Verifica o status da instância
 */
export async function checkInstanceStatus(): Promise<{ success: boolean, connected: boolean, message: string }> {
  if (!config) {
    return { success: false, connected: false, message: 'Evolution API não configurada' };
  }

  try {
    const response = await axios.get(
      `${config.baseUrl}/instance/fetchInstances`,
      {
        headers: {
          'apikey': config.apiKey
        },
        timeout: 15000
      }
    );

    if (response.data && Array.isArray(response.data)) {
      const instance = response.data.find((inst: any) => inst.instance?.instanceName === config?.instanceName);
      
      if (instance) {
        const isConnected = instance.instance?.state === 'open';
        return {
          success: true,
          connected: isConnected,
          message: isConnected ? 'Instância conectada' : 'Instância não conectada'
        };
      } else {
        return {
          success: false,
          connected: false,
          message: 'Instância não encontrada'
        };
      }
    } else {
      return {
        success: false,
        connected: false,
        message: 'Resposta inválida da API'
      };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido';
    console.error('❌ Erro ao verificar status:', errorMsg);
    return { 
      success: false, 
      connected: false,
      message: `Erro ao verificar status: ${errorMsg}`
    };
  }
}

/**
 * Configura o webhook para receber mensagens
 */
export async function setupWebhook(webhookUrl: string): Promise<{ success: boolean, message: string }> {
  if (!config) {
    return { success: false, message: 'Evolution API não configurada' };
  }

  try {
    const response = await axios.post(
      `${config.baseUrl}/webhook/set/${config.instanceName}`,
      {
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          "MESSAGES_UPSERT"
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey
        },
        timeout: 15000
      }
    );

    if (response.status === 200 || response.status === 201) {
      console.log('✅ Webhook configurado com sucesso');
      return { 
        success: true, 
        message: 'Webhook configurado com sucesso'
      };
    } else {
      return { 
        success: false, 
        message: `Erro ao configurar webhook: ${response.statusText}` 
      };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido';
    console.error('❌ Erro ao configurar webhook:', errorMsg);
    return { 
      success: false, 
      message: `Erro ao configurar webhook: ${errorMsg}`
    };
  }
}

/**
 * Envia uma mensagem via WhatsApp
 */
export async function sendMessage(phone: string, message: string): Promise<{ success: boolean, message: string }> {
  if (!config) {
    return { success: false, message: 'Evolution API não configurada' };
  }

  try {
    // Limpa o número (remove caracteres não numéricos)
    const cleanPhone = phone.replace(/\D/g, '');
    
    const response = await axios.post(
      `${config.baseUrl}/message/sendText/${config.instanceName}`,
      {
        number: cleanPhone,
        text: message
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey
        },
        timeout: 15000
      }
    );

    if (response.status === 200 || response.status === 201) {
      console.log(`✅ Mensagem enviada para ${phone}`);
      return { 
        success: true, 
        message: 'Mensagem enviada com sucesso'
      };
    } else {
      return { 
        success: false, 
        message: `Erro ao enviar mensagem: ${response.statusText}` 
      };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido';
    console.error('❌ Erro ao enviar mensagem:', errorMsg);
    return { 
      success: false, 
      message: `Erro ao enviar mensagem: ${errorMsg}`
    };
  }
}

/**
 * Processa mensagens recebidas via webhook
 */
export async function processWebhookMessage(data: any): Promise<void> {
  try {
    console.log('📱 Webhook recebido:', JSON.stringify(data, null, 2));
    
    // Verifica se há mensagens na estrutura do webhook
    if (data.data && data.data.messages && data.data.messages.length > 0) {
      const message = data.data.messages[0];
      
      // Verifica se não é uma mensagem nossa (fromMe = false)
      if (!message.fromMe && message.messageType === 'conversation') {
        const phone = message.key.remoteJid.replace('@s.whatsapp.net', '');
        const text = message.message.conversation;
        
        console.log(`📱 WhatsApp recebido de ${phone}: ${text}`);
        
        // Aqui você processará a mensagem com Claude
        await processEventMessage(phone, text);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
  }
}

/**
 * Processa evento usando Claude para interpretação
 */
async function processEventMessage(phone: string, text: string): Promise<void> {
  try {
    // Aqui integramos com Claude para interpretar a mensagem
    const claudeResponse = await interpretEventWithClaude(text);
    
    if (claudeResponse.isValid) {
      const event = claudeResponse;
      
      // Gera links para calendários
      const calendarLinks = generateCalendarLinks(event);
      
      // Monta a resposta
      const response = `🗓️ *${event.title}*\n📅 ${event.displayDate}\n\n` +
        `Adicione ao seu calendário:\n\n` +
        `📱 Google Calendar: ${calendarLinks.google}\n\n` +
        `💻 Outlook: ${calendarLinks.outlook}\n\n` +
        `📎 Arquivo ICS: ${calendarLinks.ics}`;
      
      // Envia a resposta
      await sendMessage(phone, response);
    } else {
      await sendMessage(phone, 'Não consegui entender sua mensagem como um evento. Tente algo como "reunião amanhã às 15h"');
    }
  } catch (error) {
    console.error('❌ Erro ao processar evento:', error);
    await sendMessage(phone, 'Desculpe, ocorreu um erro ao processar sua mensagem.');
  }
}

/**
 * Usa Claude para interpretar eventos em linguagem natural
 */
async function interpretEventWithClaude(text: string): Promise<any> {
  try {
    // Usar OpenRouter com Claude
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'anthropic/claude-3.5-haiku',
      messages: [{
        role: 'user',
        content: `Interprete esta mensagem em português como um evento de calendário. 
        Extraia: título, data, hora.
        Data atual: ${new Date().toLocaleDateString('pt-BR')}
        Mensagem: "${text}"
        
        Responda apenas em JSON válido:
        {
          "title": "título do evento",
          "date": "YYYY-MM-DD",
          "hour": número_hora,
          "minute": número_minuto,
          "isValid": true/false
        }`
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = JSON.parse(response.data.choices[0].message.content);
    
    if (result.isValid) {
      result.displayDate = formatBrazilianDate(new Date(`${result.date}T${String(result.hour).padStart(2, '0')}:${String(result.minute).padStart(2, '0')}:00`));
    }
    
    console.log('🤖 Claude interpretou:', text, '→', result);
    return result;
  } catch (error) {
    console.error('❌ Erro no Claude:', error);
    return { isValid: false };
  }
}

/**
 * Formata data em português brasileiro
 */
function formatBrazilianDate(date: Date): string {
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 
                  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  
  return `${dayName}, ${day} de ${month} de ${year} às ${hour}:${minute}`;
}

/**
 * Gera links para adicionar evento aos calendários
 */
function generateCalendarLinks(event: any) {
  const startDateTime = new Date(`${event.date}T${String(event.hour).padStart(2, '0')}:${String(event.minute).padStart(2, '0')}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 hora
  
  const formatDateForGoogle = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const googleStart = formatDateForGoogle(startDateTime);
  const googleEnd = formatDateForGoogle(endDateTime);
  
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${googleStart}/${googleEnd}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${startDateTime.toISOString()}&enddt=${endDateTime.toISOString()}`,
    ics: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${googleStart}
DTEND:${googleEnd}
SUMMARY:${event.title}
END:VEVENT
END:VCALENDAR`
  };
}