import type { Express } from "express";
import { createServer, type Server } from "http";
import { parseEventWithClaude } from './utils/claudeParser';
import { DateTime } from 'luxon';
import { getWhatsAppStatus, generateWhatsAppUrl, getRecommendedSolution } from './whatsapp/fallback_system';
import { getWorkingWhatsAppSolutions, getBestWhatsAppOption, getWhatsAppDirectLink, getZAPIStatus } from './whatsapp/working_solution';

interface WhatsAppMessage {
  id: string;
  from?: string;
  to?: string;
  message: string;
  timestamp: string;
  direction: 'sent' | 'received';
}

// Estado do WhatsApp ZAPI
let whatsappMessages: WhatsAppMessage[] = [];
let messageCount = 0;

// Funções auxiliares
function generateCalendarLinks(title: string, startDate: string) {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  
  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatDate(start)}/${formatDate(end)}`;
  
  return { google: googleUrl };
}

async function sendZAPIMessage(phone: string, message: string): Promise<boolean> {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  
  if (!instanceId || !token) {
    console.error('❌ Credenciais ZAPI não configuradas');
    return false;
  }

  try {
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
    const cleanPhone = phone.replace(/\D/g, '');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': token
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message
      })
    });

    const data = await response.json();
    return response.ok && !data.error;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem ZAPI:', error);
    return false;
  }
}

async function processWhatsAppMessage(from: string, messageText: string): Promise<void> {
  console.log(`📱 Processando mensagem WhatsApp: "${messageText}" de ${from}`);

  try {
    // Usar Claude para interpretar a mensagem
    const claudeResult = await parseEventWithClaude(messageText, 'America/Sao_Paulo');
    
    if (!claudeResult.isValid) {
      const response = '❌ Não consegui entender a data/hora.\n\n💡 Tente algo como:\n• "jantar hoje às 19h"\n• "reunião quarta às 15h"';
      await sendZAPIMessage(from, response);
      return;
    }

    // Criar evento
    const eventDate = DateTime.fromObject({
      year: parseInt(claudeResult.date.split('-')[0]),
      month: parseInt(claudeResult.date.split('-')[1]),
      day: parseInt(claudeResult.date.split('-')[2]),
      hour: claudeResult.hour,
      minute: claudeResult.minute
    }, { zone: 'America/Sao_Paulo' });

    const event = {
      title: claudeResult.title,
      startDate: eventDate.toISO() || eventDate.toString(),
      displayDate: eventDate.toFormat('EEEE, dd \'de\' MMMM \'às\' HH:mm', { locale: 'pt-BR' })
    };

    const links = generateCalendarLinks(event.title, event.startDate);

    const response = `✅ *Evento criado!*\n\n🎯 *${event.title}*\n📅 ${event.displayDate}\n\n📅 Adicionar ao calendário:\n${links.google}`;
    
    await sendZAPIMessage(from, response);
    console.log(`✅ Evento WhatsApp criado: ${event.title}`);

  } catch (error) {
    console.error('❌ Erro ao processar mensagem WhatsApp:', error);
    await sendZAPIMessage(from, '❌ Erro interno. Tente novamente.');
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // =================== ZAPI WhatsApp Routes ===================
  
  // Status da ZAPI
  app.get('/api/zapi/status', async (_req, res) => {
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_TOKEN;
    
    if (!instanceId || !token) {
      return res.json({
        connected: false,
        configured: false,
        error: 'Credenciais não configuradas',
        diagnosis: 'ZAPI_INSTANCE_ID e ZAPI_TOKEN não encontrados'
      });
    }

    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
      const response = await fetch(url, {
        headers: {
          'Client-Token': token
        }
      });
      
      const data = await response.json();
      
      // Diagnosticar problemas específicos
      let diagnosis = 'Funcionando normalmente';
      if (data.error === 'Client-Token is required') {
        diagnosis = 'Token inválido ou instância não ativa. Verifique se a instância ZAPI está ativa no painel.';
      } else if (!response.ok) {
        diagnosis = `Erro na API: ${data.error || 'Erro desconhecido'}`;
      } else if (!data.connected) {
        diagnosis = 'WhatsApp não conectado. É necessário escanear QR Code.';
      }
      
      res.json({
        connected: data.connected || false,
        configured: true,
        instanceId: instanceId,
        messageCount: messageCount,
        timestamp: new Date().toISOString(),
        diagnosis: diagnosis,
        apiResponse: data
      });
    } catch (error) {
      res.json({
        connected: false,
        configured: true,
        instanceId: instanceId,
        messageCount: messageCount,
        timestamp: new Date().toISOString(),
        diagnosis: 'Erro de conectividade com ZAPI. Verifique se as credenciais estão corretas.',
        error: (error as Error).message
      });
    }
  });

  // Conectar ZAPI (gerar QR)
  app.post('/api/zapi/connect', async (_req, res) => {
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_TOKEN;
    
    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Credenciais ZAPI não configuradas'
      });
    }

    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Client-Token': token,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();

      if (response.ok) {
        console.log('QR code ZAPI gerado');
        res.json({
          success: true,
          qrCode: data.qrcode || data.qr_code
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.error || 'Erro ao obter QR code'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao conectar via ZAPI'
      });
    }
  });

  // Enviar mensagem teste
  app.post('/api/zapi/send-test', async (req, res) => {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: phone, message'
      });
    }

    const success = await sendZAPIMessage(phone, message);
    
    if (success) {
      messageCount++;
      
      const messageData: WhatsAppMessage = {
        id: Date.now().toString(),
        to: phone,
        message: message,
        timestamp: new Date().toISOString(),
        direction: 'sent'
      };
      
      whatsappMessages.push(messageData);
      
      res.json({ 
        success: true, 
        messageId: messageData.id 
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erro ao enviar mensagem'
      });
    }
  });

  // Webhook para receber mensagens ZAPI
  app.post('/api/zapi/webhook', async (req, res) => {
    try {
      const { phone, message } = req.body;
      
      if (phone && message && message.text) {
        console.log(`📱 Webhook ZAPI: mensagem de ${phone}: ${message.text}`);
        
        // Processar mensagem em background
        setImmediate(() => {
          processWhatsAppMessage(phone, message.text);
        });
        
        // Responder imediatamente ao webhook
        res.status(200).json({ success: true });
      } else {
        res.status(400).json({ error: 'Dados inválidos' });
      }
    } catch (error) {
      console.error('❌ Erro no webhook ZAPI:', error);
      res.status(500).json({ error: 'Erro interno' });
    }
  });

  // Info do WhatsApp (para o botão flutuante)
  app.get('/api/whatsapp/info', async (_req, res) => {
    const workingSolutions = getWorkingWhatsAppSolutions();
    const bestOption = getBestWhatsAppOption();
    const directLink = getWhatsAppDirectLink();
    const zapiStatus = getZAPIStatus();
    
    res.json({
      phoneNumber: '5511999887766',
      connected: true,
      whatsappWebUrl: directLink,
      bestOption: bestOption,
      workingSolutions: workingSolutions,
      zapiStatus: zapiStatus,
      quickActions: [
        {
          name: 'Telegram Bot',
          url: 'https://t.me/zelar_assistente_bot',
          description: 'IA automática - mais rápido',
          recommended: true
        },
        {
          name: 'WhatsApp Web',
          url: directLink,
          description: 'Conversa direta',
          recommended: false
        }
      ]
    });
  });

  // Mensagens (para histórico)
  app.get('/api/whatsapp/messages', (_req, res) => {
    const limit = parseInt(_req.query.limit as string) || 20;
    const recentMessages = whatsappMessages.slice(-limit);
    
    res.json({
      messages: recentMessages,
      total: whatsappMessages.length
    });
  });

  return createServer(app);
}