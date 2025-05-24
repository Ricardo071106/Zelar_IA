import axios from 'axios';
import { storage } from '../storage';
import { log } from '../vite';
import { createEvent, createReminder } from './event';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Verifica se a chave da API OpenRouter está definida
if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY não está definida no ambiente');
}

interface ProcessResult {
  success: boolean;
  message: string;
  event?: {
    title: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
    location?: string;
    isAllDay?: boolean;
  };
}

/**
 * Processa uma mensagem de texto usando a API do OpenRouter
 */
export async function processTextMessage(text: string, userId: number): Promise<ProcessResult> {
  try {
    log(`Processando mensagem de texto: "${text}"`, 'telegram');
    
    const eventInfo = await extractEventInfo(text);
    
    if (!eventInfo.success) {
      return {
        success: false,
        message: 'Não consegui entender os detalhes do evento. Por favor, forneça informações mais específicas sobre o que você deseja agendar, incluindo data e hora.'
      };
    }
    
    const { event } = eventInfo;
    
    // Cria o evento no banco de dados
    const createdEvent = await createEvent({
      userId,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      isAllDay: event.isAllDay || false,
    });
    
    // Cria lembretes para o evento (24h e 30min antes)
    const reminderResults = await createDefaultReminders(createdEvent.id);
    
    // Sincroniza o evento com o calendário do usuário
    try {
      const { syncEventWithCalendar } = await import('./calendar');
      await syncEventWithCalendar(createdEvent.id);
    } catch (error) {
      log(`Não foi possível sincronizar com o calendário: ${error}`, 'telegram');
      // Não interrompe o fluxo se a sincronização falhar
    }
    
    // Formata a resposta
    const startDateFormatted = format(
      new Date(createdEvent.startDate), 
      "EEEE, dd 'de' MMMM 'às' HH:mm", 
      { locale: ptBR }
    );
    
    let endDateText = '';
    if (createdEvent.endDate) {
      const endDateFormatted = format(
        new Date(createdEvent.endDate), 
        "HH:mm", 
        { locale: ptBR }
      );
      endDateText = ` até ${endDateFormatted}`;
    }
    
    let locationText = '';
    if (createdEvent.location) {
      locationText = `\n📍 Local: ${createdEvent.location}`;
    }
    
    let descriptionText = '';
    if (createdEvent.description) {
      descriptionText = `\n📝 Descrição: ${createdEvent.description}`;
    }
    
    const message = 
      `✅ Evento criado com sucesso!\n\n` +
      `📅 *${createdEvent.title}*\n` +
      `🕒 ${startDateFormatted}${endDateText}${locationText}${descriptionText}\n\n` +
      `Lembretes foram configurados para 24 horas e 30 minutos antes do evento.`;
    
    return {
      success: true,
      message
    };
  } catch (error) {
    log(`Erro ao processar mensagem de texto: ${error}`, 'telegram');
    return {
      success: false,
      message: 'Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.'
    };
  }
}

/**
 * Processa uma mensagem de voz usando a API do OpenRouter
 */
export async function processVoiceMessage(audioUrl: string, userId: number): Promise<ProcessResult> {
  try {
    log(`Processando mensagem de voz do URL: ${audioUrl}`, 'telegram');
    
    // Baixa o arquivo de áudio
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(audioResponse.data);
    
    // Converte o áudio para texto (transcrição)
    const transcription = await transcribeAudio(audioBuffer);
    
    if (!transcription.success) {
      return {
        success: false,
        message: 'Não consegui transcrever seu áudio. Por favor, tente novamente ou envie uma mensagem de texto.'
      };
    }
    
    log(`Transcrição do áudio: "${transcription.text}"`, 'telegram');
    
    // Processa o texto transcrito
    return await processTextMessage(transcription.text, userId);
  } catch (error) {
    log(`Erro ao processar mensagem de voz: ${error}`, 'telegram');
    return {
      success: false,
      message: 'Ocorreu um erro ao processar seu áudio. Por favor, tente novamente.'
    };
  }
}

/**
 * Transcreve um arquivo de áudio para texto usando a API do OpenRouter
 */
async function transcribeAudio(audioBuffer: Buffer): Promise<{ success: boolean, text: string }> {
  try {
    // Codifica o arquivo de áudio em base64
    const base64Audio = audioBuffer.toString('base64');
    
    // Solicita a transcrição do áudio
    const response = await axios.post(
      'https://openrouter.ai/api/v1/audio/transcriptions',
      {
        file: base64Audio,
        model: 'openai/whisper-1',
        language: 'pt'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.text) {
      return {
        success: true,
        text: response.data.text
      };
    }
    
    return {
      success: false,
      text: ''
    };
  } catch (error) {
    log(`Erro na transcrição do áudio: ${error}`, 'telegram');
    return {
      success: false,
      text: ''
    };
  }
}

/**
 * Extrai informações de evento de um texto usando a API do OpenRouter
 */
async function extractEventInfo(text: string): Promise<ProcessResult> {
  try {
    const systemPrompt = 
      'Você é um assistente especializado em extrair informações de eventos a partir de mensagens. ' + 
      'Extraia as seguintes informações: título do evento, descrição (se houver), data de início, hora de início, ' + 
      'data de término (se houver), hora de término (se houver), localização (se houver), e se é um evento de dia inteiro. ' + 
      'A data e hora devem ser no formato ISO. Assuma que o evento é hoje se não houver uma data específica mencionada. ' + 
      'Se a mensagem não contiver informações suficientes para um evento, responda que não foi possível extrair os detalhes. ' +
      'Formate sua resposta em JSON com os campos: title, description, startDate, endDate, location, isAllDay. ' +
      'Se qualquer campo não for mencionado, omita-o do JSON.';
    
    const userMessage = `Extraia as informações de evento desta mensagem: "${text}"`;
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      return {
        success: false,
        message: 'Não consegui processar a resposta da API.',
      };
    }
    
    const content = response.data.choices[0].message.content;
    
    try {
      const eventData = JSON.parse(content);
      
      // Verifica se temos dados suficientes para criar um evento
      if (!eventData.title || !eventData.startDate) {
        return {
          success: false,
          message: 'Não consegui extrair informações suficientes para criar um evento.',
        };
      }
      
      // Converte as strings de data para objetos Date
      const startDate = new Date(eventData.startDate);
      const endDate = eventData.endDate ? new Date(eventData.endDate) : undefined;
      
      // Verifica se as datas são válidas
      if (isNaN(startDate.getTime()) || (endDate && isNaN(endDate.getTime()))) {
        return {
          success: false,
          message: 'As datas fornecidas não são válidas.',
        };
      }
      
      return {
        success: true,
        message: 'Informações do evento extraídas com sucesso.',
        event: {
          title: eventData.title,
          description: eventData.description,
          startDate,
          endDate,
          location: eventData.location,
          isAllDay: eventData.isAllDay || false
        }
      };
    } catch (error) {
      log(`Erro ao analisar JSON da resposta: ${error}`, 'telegram');
      log(`Conteúdo recebido: ${content}`, 'telegram');
      
      return {
        success: false,
        message: 'Não consegui processar as informações do evento.',
      };
    }
  } catch (error) {
    log(`Erro ao extrair informações do evento: ${error}`, 'telegram');
    return {
      success: false,
      message: 'Ocorreu um erro ao processar as informações do evento.',
    };
  }
}

/**
 * Cria lembretes padrão para um evento (24h e 30min antes)
 */
async function createDefaultReminders(eventId: number) {
  try {
    const event = await storage.getEvent(eventId);
    
    if (!event) {
      throw new Error(`Evento com ID ${eventId} não encontrado`);
    }
    
    const startDate = new Date(event.startDate);
    
    // Cria lembrete para 24 horas antes
    const reminder24h = new Date(startDate);
    reminder24h.setDate(reminder24h.getDate() - 1);
    
    await createReminder({
      eventId,
      reminderTime: reminder24h,
      type: '24h'
    });
    
    // Cria lembrete para 30 minutos antes
    const reminder30min = new Date(startDate);
    reminder30min.setMinutes(reminder30min.getMinutes() - 30);
    
    await createReminder({
      eventId,
      reminderTime: reminder30min,
      type: '30min'
    });
    
    return {
      success: true,
      message: 'Lembretes criados com sucesso'
    };
  } catch (error) {
    log(`Erro ao criar lembretes: ${error}`, 'telegram');
    return {
      success: false,
      message: `Erro ao criar lembretes: ${error}`
    };
  }
}