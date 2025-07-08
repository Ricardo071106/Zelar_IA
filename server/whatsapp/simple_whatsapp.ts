/**
 * Bot WhatsApp Simples - Sem Puppeteer
 * Gera QR codes simulados para demonstração
 */

import { generateQRCodeImage } from '../utils/qrCodeGenerator';
import { parseEventWithClaude } from '../utils/claudeParser';

let isConnected = false;
let qrCodeData = '';
let qrCodeImage = '';
let connectionStatus = 'disconnected';

interface WhatsAppEvent {
  title: string;
  startDate: string;
  description: string;
  displayDate: string;
}

/**
 * Simula dados de QR code WhatsApp reais
 */
function generateWhatsAppQRData(): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const deviceId = Math.random().toString(36).substring(2, 10);
  
  // Formato similar ao QR code real do WhatsApp
  return `1@${randomId}${deviceId},${timestamp},${deviceId}${timestamp}`;
}

/**
 * Inicia o bot WhatsApp (versão simulada)
 */
export async function startWhatsAppBot(): Promise<boolean> {
  try {
    console.log('🚀 Iniciando WhatsApp bot (modo demonstração)...');
    
    // Simular processo de conexão
    connectionStatus = 'connecting';
    
    setTimeout(async () => {
      try {
        // Gerar QR code simulado
        qrCodeData = generateWhatsAppQRData();
        console.log('🔄 Gerando QR Code:', qrCodeData);
        
        // Gerar imagem do QR code
        qrCodeImage = await generateQRCodeImage(qrCodeData);
        console.log('✅ QR Code gerado! Tamanho:', qrCodeImage.length);
        
        connectionStatus = 'qr_code';
        console.log('📱 QR Code real gerado com sucesso!');
        console.log('📱 Tipo:', qrCodeImage.substring(0, 30) + '...');
        console.log('📱 QR Code gerado! Acesse /whatsapp para visualizar');
      } catch (error) {
        console.error('❌ Erro ao gerar QR code:', error);
        connectionStatus = 'error';
      }
    }, 1000);
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao iniciar WhatsApp bot:', error);
    connectionStatus = 'error';
    return false;
  }
}

/**
 * Para o bot WhatsApp
 */
export async function stopWhatsAppBot(): Promise<void> {
  try {
    isConnected = false;
    connectionStatus = 'disconnected';
    qrCodeData = '';
    qrCodeImage = '';
    console.log('🛑 WhatsApp bot parado');
  } catch (error) {
    console.error('❌ Erro ao parar WhatsApp bot:', error);
  }
}

/**
 * Simula envio de mensagem
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    if (!isConnected) {
      console.log('📱 Simulando envio para', phone, ':', message);
      return false;
    }
    
    console.log('✅ Mensagem simulada enviada para', phone);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return false;
  }
}

/**
 * Obtém status do WhatsApp
 */
export function getWhatsAppStatus(): any {
  return {
    connected: isConnected,
    status: connectionStatus,
    qrCode: qrCodeData,
    qrCodeImage: qrCodeImage,
    hasQrCode: qrCodeData.length > 0,
    hasQrCodeImage: qrCodeImage.length > 0
  };
}

/**
 * Simula conexão bem-sucedida (para demonstração)
 */
export function simulateConnection(): void {
  isConnected = true;
  connectionStatus = 'connected';
  qrCodeData = '';
  qrCodeImage = '';
  console.log('✅ WhatsApp conectado (simulação)');
}

/**
 * Processa mensagem recebida (simulação)
 */
export async function processMessage(from: string, text: string): Promise<string> {
  try {
    console.log(`📱 Processando mensagem de ${from}: ${text}`);
    
    // Comandos especiais
    if (text.toLowerCase() === '/start' || text.toLowerCase() === '/help') {
      return `🤖 *Olá! Sou o Zelar*

Seu assistente inteligente de agendamento!

*Como usar:*
📝 Envie mensagens naturais como:
• "Reunião amanhã às 14h"
• "Dentista sexta-feira 9h"
• "Almoço com Maria domingo 12h"

*Funcionalidades:*
✅ Criação automática de eventos
📅 Links para Google Calendar, Outlook e Apple
🤖 Interpretação inteligente de datas em português
📱 Integração perfeita com seus calendários

Digite sua mensagem e eu criarei o evento para você!`;
    }

    // Processar como possível evento
    if (text.length > 10) {
      const claudeResult = await parseEventWithClaude(text);
      
      if (!claudeResult || !claudeResult.isValid) {
        return 'Não consegui entender sua mensagem como um evento. Tente algo como:\n"Reunião amanhã às 14h"\n"Dentista sexta-feira 9h"';
      }

      // Criar evento
      const event: WhatsAppEvent = {
        title: claudeResult.title,
        startDate: claudeResult.date,
        description: `Evento criado via WhatsApp por ${from}`,
        displayDate: new Date(claudeResult.date).toLocaleString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      // Gerar links do calendário
      const calendarLinks = generateCalendarLinks(event);

      return `✅ *Evento Criado!*

📅 *${event.title}*
🗓️ ${event.displayDate}

*Adicionar ao calendário:*
📱 Google Calendar: ${calendarLinks.google}
📧 Outlook: ${calendarLinks.outlook}
🍎 Apple Calendar: ${calendarLinks.apple}

Digite /help para mais comandos.`;
    }

    return 'Olá! Sou o Zelar, seu assistente de agendamento.\n\nEnvie uma mensagem como:\n"Reunião amanhã às 14h"\n"Dentista sexta-feira 9h"\n\nPara mais ajuda, digite /help';
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.';
  }
}

/**
 * Função auxiliar para gerar links de calendário
 */
function generateCalendarLinks(event: WhatsAppEvent) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hora depois
  
  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${encodeURIComponent(event.description)}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${formatDate(startDate)}&enddt=${formatDate(endDate)}&body=${encodeURIComponent(event.description)}`,
    apple: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
END:VEVENT
END:VCALENDAR`
  };
}