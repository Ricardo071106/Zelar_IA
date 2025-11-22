/**
 * WhatsApp Bot usando Baileys
 * Implementação robusta seguindo documentação oficial
 * Com todas as funcionalidades do Telegram Bot
 */
import { makeWASocket, DisconnectReason, useMultiFileAuthState, WASocket, proto } from '@whiskeysockets/baileys';
import { parseEventWithClaude } from '../utils/claudeParser';
import { generateCalendarLinks } from '../utils/calendarUtils';
import { parseUserDateTime, extractEventTitle, getUserTimezone } from '../telegram/utils/parseDate';
import { storage } from '../storage';
import type { InsertEvent } from '@shared/schema';
import { DateTime } from 'luxon';
import qrcode from 'qrcode';
import { addEventToGoogleCalendar, setTokens, cancelGoogleCalendarEvent } from '../telegram/googleCalendarIntegration';
import { reminderService } from '../services/reminderService';

interface WhatsAppBotStatus {
  isReady: boolean;
  isConnected: boolean;
  qrCode?: string;
  qrCodeImage?: string;
  clientInfo?: any;
}

function parseReminderOffset(token: string): number | null {
  const match = token.match(/^(\d+)(h|m)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  if (Number.isNaN(value)) return null;
  return match[2].toLowerCase() === 'm' ? value / 60 : value;
}

export class WhatsAppBot {
  private sock: WASocket | null = null;
  private status: WhatsAppBotStatus = {
    isReady: false,
    isConnected: false
  };
  private qrCodeCallbacks: Set<(qr: string) => void> = new Set();
  private statusCallbacks: Set<(status: WhatsAppBotStatus) => void> = new Set();

  constructor() {
    // Baileys não precisa de inicialização no construtor
    console.log('🔧 WhatsApp Bot criado (Baileys)');
  }

  private async setupEventHandlers(sock: WASocket, saveCreds: () => Promise<void>): Promise<void> {
    console.log('🔧 Configurando event handlers do WhatsApp...');
    
    // Listener de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('🔗 QR Code recebido!');
        this.status.qrCode = qr;
        this.status.isConnected = false;
        this.status.isReady = true;
        
        try {
          const qrCodeString = await qrcode.toString(qr, { type: 'terminal', small: true });
          console.log('\n� ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:\n');
          console.log(qrCodeString);
          console.log('\n📋 Como conectar:');
          console.log('1. Abra o WhatsApp no seu celular');
          console.log('2. Toque em Menu (3 pontos) → Dispositivos conectados');
          console.log('3. Toque em Conectar dispositivo');
          console.log('4. Aponte a câmera para o QR code acima\n');
        } catch (error) {
          console.error('❌ Erro ao gerar QR code visual:', error);
        }
        
        this.qrCodeCallbacks.forEach(callback => callback(qr));
        this.notifyStatusChange();
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('❌ Conexão fechada, reconectando:', shouldReconnect);
        
        if (shouldReconnect) {
          setTimeout(() => this.initialize(), 3000);
        } else {
          this.status.isConnected = false;
          this.status.isReady = false;
          this.notifyStatusChange();
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp Bot está pronto!');
        this.status.isConnected = true;
        this.status.isReady = true;
        this.status.qrCode = undefined;
        this.notifyStatusChange();
      }
    });

    // Listener de credenciais
    sock.ev.on('creds.update', saveCreds);
    
    // Listener para mensagens recebidas
    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;
      
      await this.handleMessage(msg);
    });
    
    console.log('✅ Event handlers configurados com sucesso!');
  }

  private async handleMessage(msg: proto.IWebMessageInfo): Promise<void> {
    try {
      // Extrair informações da mensagem
      const from = msg.key.remoteJid;
      if (!from) return;

      // Ignorar grupos
      if (from.includes('@g.us')) return;

      // Extrair texto da mensagem
      const text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || '';
      
      if (!text) return;

      console.log(`📩 Mensagem recebida de ${from}: ${text}`);

      const whatsappId = from;

      // Comando /start
      if (text === '/start' || text.toLowerCase().includes('olá, gostaria de usar o zelar')) {
        try {
          let dbUser = await storage.getUserByWhatsApp(whatsappId);
          
          if (!dbUser) {
            dbUser = await storage.createUser({
              username: whatsappId,
              password: `whatsapp_${whatsappId}`,
              name: whatsappId.split('@')[0],
            });
            
            await storage.createUserSettings({
              userId: dbUser.id,
              notificationsEnabled: true,
              reminderTimes: [12],
              language: 'pt-BR',
              timeZone: 'America/Sao_Paulo',
            });
            
            console.log(`✅ Novo usuário WhatsApp criado: ${whatsappId} (ID: ${dbUser.id})`);
          } else {
            console.log(`✅ Usuário WhatsApp existente: ${whatsappId} (ID: ${dbUser.id})`);
          }
        } catch (error) {
          console.error('❌ Erro ao buscar/criar usuário WhatsApp:', error);
        }
        
        const response =
          '🤖 *Zelar - Assistente de Agendamento*\n\n' +
          '💡 *Como usar:*\n' +
          '• "jantar hoje às 19h"\n' +
          '• "reunião amanhã às 15h"\n' +
          '• "consulta sexta às 10h"\n\n' +
          '🌍 *Fuso horário:* Brasil (UTC-3)\n\n' +
          '📝 *Comandos disponíveis:*\n' +
          '/help - Ajuda completa\n' +
          '/eventos - Ver seus eventos\n' +
          '/editar - Editar evento\n' +
          '/deletar - Deletar evento\n' +
          '/conectar - Conectar Google Calendar\n' +
          '/desconectar - Desconectar Google Calendar\n' +
          '/status - Status da conexão\n' +
          '/fuso - Alterar fuso horário\n\n' +
          'Envie qualquer mensagem com data e horário para criar um evento!';
        await this.sendMessage(from, response);
        return;
      }

      // Comando /help
      if (text === '/help') {
        const helpText = `
Assistente Zelar - Ajuda

Como usar:
Envie mensagens como:
- "reunião com cliente amanhã às 14h"
- "jantar com família sexta às 19h30"
- "consulta médica terça às 10h"
- "call de projeto quinta às 15h"

Comandos:
/eventos - Ver próximos eventos
/editar - Editar evento
/deletar - Deletar evento
/lembretes - Listar lembretes
lembrete ID 2h - Criar lembrete (horas antes)
editarlembrete ID 1h - Editar lembrete
deletarlembrete ID - Remover lembrete
/conectar - Conectar Google Calendar
/desconectar - Desconectar Google Calendar
/status - Status da conexão
/fuso - Alterar fuso horário
/start - Mensagem inicial
`;
        await this.sendMessage(from, helpText.trim());
        return;
      }

      // Comando /conectar - Conectar Google Calendar
      if (text === '/conectar') {
        try {
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          
          if (!dbUser) {
            await this.sendMessage(from, 
              '❌ *Usuário não encontrado*\n\n' +
              'Por favor, envie /start primeiro para criar sua conta.'
            );
            return;
          }
          
          const settings = await storage.getUserSettings(dbUser.id);
          
          if (settings?.googleTokens) {
            await this.sendMessage(from, 
              '✅ *Você já está conectado!*\n\n' +
              'Seu Google Calendar já está integrado.\n' +
              'Use /desconectar se quiser remover a conexão.'
            );
            return;
          }
          
          // Gerar URL de autorização
          const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
          const authUrl = `${baseUrl}/api/auth/google/authorize?userId=${encodeURIComponent(whatsappId)}&platform=whatsapp`;
          
          await this.sendMessage(from, 
            '🔐 *Conectar Google Calendar*\n\n' +
            'Para criar eventos automaticamente no seu Google Calendar, ' +
            'você precisa autorizar o acesso.\n\n' +
            '🔗 Copie e cole este link no navegador:\n' +
            `${authUrl}\n\n` +
            '✨ Após autorizar, seus eventos serão criados automaticamente!'
          );
        } catch (error) {
          console.error('❌ Erro ao gerar URL de autorização:', error);
          await this.sendMessage(from, 
            '❌ *Erro ao conectar*\n\n' +
            'Ocorreu um erro ao gerar o link de autorização.\n' +
            'Por favor, tente novamente mais tarde.'
          );
        }
        return;
      }

      // Comando /desconectar - Desconectar Google Calendar
      if (text === '/desconectar') {
        try {
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          
          if (!dbUser) {
            await this.sendMessage(from, '❌ Usuário não encontrado.');
            return;
          }
          
          const settings = await storage.getUserSettings(dbUser.id);
          
          if (!settings?.googleTokens) {
            await this.sendMessage(from, 
              '📭 *Não conectado*\n\n' +
              'Você não está conectado ao Google Calendar.\n' +
              'Use /conectar para fazer a conexão.'
            );
            return;
          }
          
          // Desconectar
          await storage.updateUserSettings(dbUser.id, {
            googleTokens: null,
            calendarProvider: null,
          });
          
          await this.sendMessage(from, 
            '✅ *Desconectado com sucesso!*\n\n' +
            'Seu Google Calendar foi desconectado.\n' +
            'Use /conectar quando quiser conectar novamente.'
          );
        } catch (error) {
          console.error('❌ Erro ao desconectar:', error);
          await this.sendMessage(from, '❌ Erro ao desconectar. Tente novamente.');
        }
        return;
      }

      // Comando /status - Ver status da conexão
      if (text === '/status') {
        try {
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          
          if (!dbUser) {
            await this.sendMessage(from, '❌ Usuário não encontrado. Use /start primeiro.');
            return;
          }
          
          const settings = await storage.getUserSettings(dbUser.id);
          const isConnected = !!(settings?.googleTokens);
          
          if (isConnected) {
            await this.sendMessage(from, 
              '✅ *Google Calendar Conectado*\n\n' +
              '🔗 Seu Google Calendar está integrado\n' +
              '✨ Eventos são criados automaticamente\n\n' +
              'Use /desconectar para remover a conexão.'
            );
          } else {
            await this.sendMessage(from, 
              '📭 *Google Calendar não conectado*\n\n' +
              '🔗 Use /conectar para integrar seu calendário\n' +
              '✨ Eventos serão criados automaticamente após conectar!'
            );
          }
        } catch (error) {
          console.error('❌ Erro ao verificar status:', error);
          await this.sendMessage(from, '❌ Erro ao verificar status.');
        }
        return;
      }

      // Comando /eventos - Listar eventos do usuário
      if (text === '/eventos') {
        try {
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          
          if (!dbUser) {
            await this.sendMessage(from, 
              '📭 *Nenhum evento encontrado*\n\n' +
              'Você ainda não criou nenhum evento.\n' +
              'Envie uma mensagem como "reunião amanhã às 14h" para criar seu primeiro evento!'
            );
            return;
          }
          
          const events = await storage.getUpcomingEvents(dbUser.id, 10);
          
          if (events.length === 0) {
            await this.sendMessage(from, 
              '📭 *Nenhum evento próximo*\n\n' +
              'Você não tem eventos futuros agendados.\n' +
              'Envie uma mensagem como "consulta médica sexta às 10h" para criar um evento!'
            );
            return;
          }
          
          let response = '📅 *Seus próximos eventos:*\n\n';
          
          events.forEach((event, index) => {
            const date = DateTime.fromJSDate(event.startDate).setZone('America/Sao_Paulo');
            const formattedDate = date.toFormat('dd/MM/yyyy HH:mm', { locale: 'pt-BR' });
            const dayOfWeek = date.toFormat('EEEE', { locale: 'pt-BR' });
            
            response += `${index + 1}. 🎯 *${event.title}*\n`;
            response += `   📅 ${dayOfWeek}, ${formattedDate}\n`;
            response += `   🆔 ID: ${event.id}\n`;
            if (event.description && event.description !== event.title) {
              response += `   📝 ${event.description}\n`;
            }
            response += '\n';
          });
          
          response += '\n💡 Use "editar ID novo texto" para editar\n';
          response += '💡 Use "deletar ID" para deletar';
          
          await this.sendMessage(from, response);
        } catch (error) {
          console.error('❌ Erro ao buscar eventos:', error);
          await this.sendMessage(from, '❌ Erro ao buscar seus eventos. Tente novamente mais tarde.');
        }
        return;
      }


      // Comando /lembretes - Listar lembretes pendentes
      if (text === '/lembretes') {
        try {
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          
          if (!dbUser) {
            await this.sendMessage(from, '❌ Usuário não encontrado. Use /start primeiro.');
            return;
          }
          
          const settings = await storage.getUserSettings(dbUser.id);
          const timezone = settings?.timeZone || 'America/Sao_Paulo';
          const reminders = await storage.getUserPendingReminders(dbUser.id);
          
          if (reminders.length === 0) {
            await this.sendMessage(from, 'ℹ️ Nenhum lembrete pendente. Use "lembrete ID 2h" para criar.');
            return;
          }
          
          let response = '✅ Lembretes pendentes:\\n\\n';
          for (const reminder of reminders) {
            const event = await storage.getEvent(reminder.eventId);
            if (!event) continue;
            const sendTime = DateTime.fromJSDate(reminder.sendAt).setZone(timezone).toFormat('dd/MM/yyyy HH:mm');
            response += `#${reminder.id} - ${event.title}\\n`;
            response += `  Envio: ${sendTime} (${reminder.channel})\\n`;
            response += `  Evento: ${event.id}\\n\\n`;
          }
          
          response += 'Criar: lembrete EVENTO_ID 2h\\n';
          response += 'Editar: editarlembrete ID 1h\\n';
          response += 'Deletar: deletarlembrete ID';
          
          await this.sendMessage(from, response);
        } catch (error) {
          console.error('Erro ao listar lembretes:', error);
          await this.sendMessage(from, 'Nao foi possivel listar seus lembretes agora.');
        }
        return;
      }

      // Comando /deletar - Deletar evento
      if (text === '/deletar') {
        try {
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          
          if (!dbUser) {
            await this.sendMessage(from, '❌ Usuário não encontrado. Use /start primeiro.');
            return;
          }
          
          const events = await storage.getUpcomingEvents(dbUser.id, 10);
          
          if (events.length === 0) {
            await this.sendMessage(from, 
              '📭 *Nenhum evento para deletar*\n\n' +
              'Você não tem eventos futuros agendados.'
            );
            return;
          }
          
          let response = '🗑️ *Deletar Evento*\n\n';
          response += 'Para deletar, envie: *deletar ID*\n\n';
          response += '*Seus eventos:*\n\n';
          
          events.forEach((event, index) => {
            const date = DateTime.fromJSDate(event.startDate).setZone('America/Sao_Paulo');
            const formattedDate = date.toFormat('dd/MM HH:mm');
            response += `${index + 1}. 🆔 ${event.id} - *${event.title}*\n`;
            response += `   📅 ${formattedDate}\n\n`;
          });
          
          await this.sendMessage(from, response);
          
        } catch (error) {
          console.error('❌ Erro ao listar eventos para deletar:', error);
          await this.sendMessage(from, '❌ Erro ao buscar eventos. Tente novamente.');
        }
        return;
      }


      // Criar lembrete manual
      if (text.toLowerCase().startsWith('lembrete ')) {
        const parts = text.split(' ');
        const eventId = parseInt(parts[1]);
        const offset = parseReminderOffset(parts[2] || '');
        const customMessage = parts.slice(3).join(' ').trim() || undefined;

        if (Number.isNaN(eventId) || offset === null) {
          await this.sendMessage(from, '❌ Formato inválido.\nUse: `lembrete ID 2h` ou `lembrete ID 30m`');
          return;
        }

        try {
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          if (!dbUser) {
            await this.sendMessage(from, '❌ Usuário não encontrado. Envie `/start`.');
            return;
          }

          const event = await storage.getEvent(eventId);
          if (!event || event.userId !== dbUser.id) {
            await this.sendMessage(from, '❌ Evento não encontrado ou sem permissão.');
            return;
          }

          const reminder = await reminderService.createReminderWithOffset(event, 'whatsapp', offset, customMessage);
          const settings = await storage.getUserSettings(dbUser.id);
          const timezone = settings?.timeZone || 'America/Sao_Paulo';
          const sendTime = DateTime.fromJSDate(reminder.sendAt).setZone(timezone).toFormat('dd/MM/yyyy HH:mm');

          await this.sendMessage(from,
            `✅ Lembrete criado!
` +
            `Lembrete: ${reminder.id}
` +
            `Evento: ${event.title}
` +
            `Envio: ${sendTime}`
          );
        } catch (error) {
          console.error('? Erro ao criar lembrete:', error);
          await this.sendMessage(from, '❌ Erro ao criar lembrete.');
        }
        return;
      }

      // Editar lembrete existente
      if (text.toLowerCase().startsWith('editarlembrete ')) {
        const parts = text.split(' ');
        const reminderId = parseInt(parts[1]);
        const offset = parseReminderOffset(parts[2] || '');
        const customMessage = parts.slice(3).join(' ').trim() || undefined;

        if (Number.isNaN(reminderId) || offset === null) {
          await this.sendMessage(from, '❌ Formato inválido.\n Use: `editarlembrete ID 1h` ou `editarlembrete ID 30m`');
          return;
        }

        try {
          const reminder = await storage.getReminder(reminderId);
          if (!reminder) {
            await this.sendMessage(from, '❌ Lembrete não encontrado.');
            return;
          }

          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          if (!dbUser || reminder.userId !== dbUser.id) {
            await this.sendMessage(from, '❌ Você não tem permissão para editar este lembrete.');
            return;
          }

          const event = await storage.getEvent(reminder.eventId);
          if (!event) {
            await this.sendMessage(from, '❌ Evento associado não encontrado.');
            return;
          }

          const updated = await reminderService.updateReminderWithOffset(reminderId, event, offset, customMessage);
          if (!updated) {
            await this.sendMessage(from, '❌ Não foi possível atualizar o lembrete.');
            return;
          }

          const settings = await storage.getUserSettings(dbUser.id);
          const timezone = settings?.timeZone || 'America/Sao_Paulo';
          const sendTime = DateTime.fromJSDate(updated.sendAt).setZone(timezone).toFormat('dd/MM/yyyy HH:mm');
          await this.sendMessage(from, `✅ Lembrete atualizado!
Envio: ${sendTime}`);
        } catch (error) {
          console.error('❌ Erro ao editar lembrete:', error);
          await this.sendMessage(from, '❌ Erro ao editar lembrete.');
        }
        return;
      }

      // Deletar lembrete
      if (text.toLowerCase().startsWith('deletarlembrete ')) {
        const parts = text.split(' ');
        const reminderId = parseInt(parts[1]);
        if (Number.isNaN(reminderId)) {
          await this.sendMessage(from, '❌ ID do lembrete inválido.');
          return;
        }

        try {
          const reminder = await storage.getReminder(reminderId);
          if (!reminder) {
            await this.sendMessage(from, '❌ Lembrete não encontrado.');
            return;
          }

          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          if (!dbUser || reminder.userId !== dbUser.id) {
            await this.sendMessage(from, '❌ Você não tem permissão para deletar este lembrete.');
            return;
          }

          await reminderService.deleteReminder(reminderId);
          await this.sendMessage(from, `✅ Lembrete #${reminderId} deletado.`);
        } catch (error) {
          console.error('❌ Erro ao deletar lembrete:', error);
          await this.sendMessage(from, '❌ Erro ao deletar lembrete.');
        }
        return;
      }

      // Comando /editar - Editar evento
      if (text === '/editar') {
        try {
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          
          if (!dbUser) {
            await this.sendMessage(from, '❌ Usuário não encontrado. Use `/start` primeiro.');
            return;
          }
          
          const events = await storage.getUpcomingEvents(dbUser.id, 10);
          
          if (events.length === 0) {
            await this.sendMessage(from, 
              '📭 *Nenhum evento para editar*\n\n' +
              'Você não tem eventos futuros agendados.'
            );
            return;
          }
          
          let response = '✏️ *Editar Evento*\n\n';
          response += 'Para editar, envie:\n';
          response += '*editar ID novo título amanhã às 15h*\n\n';
          response += '*Seus eventos:*\n\n';
          
          events.forEach((event, index) => {
            const date = DateTime.fromJSDate(event.startDate).setZone('America/Sao_Paulo');
            const formattedDate = date.toFormat('dd/MM HH:mm');
            response += `${index + 1}. 🆔 ${event.id} - *${event.title}*\n`;
            response += `   📅 ${formattedDate}\n\n`;
          });
          
          await this.sendMessage(from, response);
          
        } catch (error) {
          console.error('❌ Erro ao listar eventos para editar:', error);
          await this.sendMessage(from, '❌ Erro ao buscar eventos. Tente novamente.');
        }
        return;
      }

      // Comando /fuso - Alterar fuso horário
      if (text === '/fuso') {
        const response =
          '🌍 *Selecione seu fuso horário:*\n\n' +
          'Envie: */fuso CODIGO*\n\n' +
          '🇧🇷 Brasil/Argentina: America/Sao_Paulo\n' +
          '🇺🇸 EUA Leste: America/New_York\n' +
          '🇺🇸 EUA Central: America/Chicago\n' +
          '🇺🇸 EUA Oeste: America/Los_Angeles\n' +
          '🇬🇧 Londres: Europe/London\n' +
          '🇪🇺 Europa Central: Europe/Paris\n' +
          '🇷🇺 Moscou: Europe/Moscow\n' +
          '🇮🇳 Índia: Asia/Kolkata\n' +
          '🇨🇳 China: Asia/Shanghai\n' +
          '🇯🇵 Japão: Asia/Tokyo\n' +
          '🇦🇺 Austrália: Australia/Sydney\n\n' +
          'Exemplo: /fuso America/Sao_Paulo';
        await this.sendMessage(from, response);
        return;
      }

      // Processar comando de deletar "deletar ID"
      if (text.toLowerCase().startsWith('deletar ')) {
        try {
          const parts = text.split(' ');
          const eventId = parseInt(parts[1]);
          
          if (isNaN(eventId)) {
            await this.sendMessage(from, '❌ ID do evento inválido. Use: deletar ID');
            return;
          }
          
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          if (!dbUser) {
            await this.sendMessage(from, '❌ Usuário não encontrado.');
            return;
          }
          
          // Buscar evento
          const event = await storage.getEvent(eventId);
          
          if (!event) {
            await this.sendMessage(from, '❌ Evento não encontrado.');
            return;
          }
          
          // Verificar permissão
          if (event.userId !== dbUser.id) {
            await this.sendMessage(from, '❌ Você não tem permissão para deletar este evento.');
            return;
          }
          
          // Deletar do Google Calendar se conectado
          const settings = await storage.getUserSettings(dbUser.id);
          if (settings?.googleTokens && event.calendarId) {
            try {
              setTokens(dbUser.id, settings.googleTokens);
              await cancelGoogleCalendarEvent(event.calendarId, dbUser.id);
              console.log(`✅ Evento deletado do Google Calendar: ${event.calendarId}`);
            } catch (error) {
              console.error('❌ Erro ao deletar do Google Calendar:', error);
            }
          }
          
          // Deletar do banco
          await reminderService.deleteEventReminders(eventId);
          await storage.deleteEvent(eventId);
          
          await this.sendMessage(from, 
            `✅ *Evento deletado com sucesso!*\n\n` +
            `🗑️ ${event.title}\n\n` +
            `O evento foi removido do banco de dados` +
            (settings?.googleTokens ? ' e do Google Calendar.' : '.')
          );
          
        } catch (error) {
          console.error('❌ Erro ao deletar evento:', error);
          await this.sendMessage(from, '❌ Erro ao deletar evento. Tente novamente.');
        }
        return;
      }

      // Processar comando de edição "editar ID ..."
      if (text.toLowerCase().startsWith('editar ')) {
        try {
          const parts = text.split(' ');
          const eventId = parseInt(parts[1]);
          
          if (isNaN(eventId)) {
            await this.sendMessage(from, '❌ ID do evento inválido. Use: editar ID texto');
            return;
          }
          
          const dbUser = await storage.getUserByWhatsApp(whatsappId);
          if (!dbUser) {
            await this.sendMessage(from, '❌ Usuário não encontrado.');
            return;
          }
          
          // Buscar evento
          const event = await storage.getEvent(eventId);
          
          if (!event) {
            await this.sendMessage(from, '❌ Evento não encontrado.');
            return;
          }
          
          // Verificar permissão
          if (event.userId !== dbUser.id) {
            await this.sendMessage(from, '❌ Você não tem permissão para editar este evento.');
            return;
          }
          
          // Pegar o texto após o ID
          const newContent = parts.slice(2).join(' ');
          
          if (!newContent) {
            await this.sendMessage(from, `❌ Forneça o novo conteúdo. Exemplo: editar ${eventId} reunião amanhã às 15h`);
            return;
          }
          
          // Interpretar novo conteúdo com Claude
          const userTimezone = getUserTimezone(whatsappId);
          const claudeResult = await parseEventWithClaude(newContent, userTimezone);
          
          if (!claudeResult.isValid) {
            await this.sendMessage(from, '❌ Não consegui entender a nova data/hora. Tente novamente.');
            return;
          }
          
          // Criar nova data
          const newDate = DateTime.fromFormat(claudeResult.date, 'yyyy-MM-dd', { zone: userTimezone })
            .set({ hour: claudeResult.hour, minute: claudeResult.minute });
          
          const newTitle = extractEventTitle(newContent);
          const newEndDate = newDate.plus({ hours: 1 });
          
          // Atualizar no banco
          const updatedEvent = await storage.updateEvent(eventId, {
            title: newTitle,
            description: newTitle,
            startDate: newDate.toJSDate(),
            endDate: newEndDate.toJSDate(),
          });
          
          if (updatedEvent) {
            await reminderService.ensureDefaultReminder(updatedEvent, 'whatsapp');
          }
          
          // Atualizar no Google Calendar se conectado
          const settings = await storage.getUserSettings(dbUser.id);
          if (settings?.googleTokens) {
            try {
              setTokens(dbUser.id, settings.googleTokens);
              
              // Deletar evento antigo
              if (event.calendarId) {
                await cancelGoogleCalendarEvent(event.calendarId, dbUser.id);
              }
              
              // Criar novo evento
              const updatedEvent: any = {
                title: newTitle,
                description: newTitle,
                startDate: newDate.toJSDate(),
                endDate: newEndDate.toJSDate(),
              };
              
              const calendarResult = await addEventToGoogleCalendar(updatedEvent, dbUser.id);
              
              // Atualizar ID do evento no Google Calendar
              if (calendarResult?.success && calendarResult.calendarEventId) {
                await storage.updateEvent(eventId, {
                  calendarId: calendarResult.calendarEventId,
                  conferenceLink: calendarResult.conferenceLink || undefined,
                });
              }
              
              console.log(`✅ Evento atualizado no Google Calendar`);
            } catch (error) {
              console.error('❌ Erro ao atualizar no Google Calendar:', error);
            }
          }
          
          const formattedDate = newDate.toFormat('dd/MM/yyyy HH:mm', { locale: 'pt-BR' });
          await this.sendMessage(from, 
            `✅ *Evento atualizado com sucesso!*\n\n` +
            `🎯 *${newTitle}*\n` +
            `📅 ${formattedDate}\n\n` +
            (settings?.googleTokens ? '✨ Atualizado também no Google Calendar!' : '')
          );
          
        } catch (error) {
          console.error('❌ Erro ao editar evento:', error);
          await this.sendMessage(from, '❌ Erro ao editar evento. Tente novamente.');
        }
        return;
      }

      // Processar evento normalmente
      console.log(`🔍 [DEBUG] Processando mensagem: "${text}"`);
      
      // Buscar ou criar usuário no banco
      let dbUser;
      try {
        dbUser = await storage.getUserByWhatsApp(whatsappId);
        
        if (!dbUser) {
          // Criar novo usuário se não existir
          dbUser = await storage.createUser({
            username: whatsappId,
            password: `whatsapp_${whatsappId}`,
            name: whatsappId.split('@')[0],
          });
          
          await storage.createUserSettings({
            userId: dbUser.id,
            notificationsEnabled: true,
            reminderTimes: [12],
            language: 'pt-BR',
            timeZone: 'America/Sao_Paulo',
          });
          
          console.log(`✅ Novo usuário criado ao processar evento: ${whatsappId} (ID: ${dbUser.id})`);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar/criar usuário:', error);
      }
      
      const result = parseUserDateTime(text, whatsappId);
      console.log(`🔍 [DEBUG] Resultado do parser:`, result);
      
      const cleanTitle = extractEventTitle(text);
      console.log(`🟢 [DEBUG] Título limpo: "${cleanTitle}"`);
      
      if (result) {
        const date = new Date(result.iso);
        
        // Salvar evento no banco de dados
        if (dbUser) {
          try {
            const startDate = DateTime.fromJSDate(date);
            const endDate = startDate.plus({ hours: 1 });
            
            const insertEvent: InsertEvent = {
              userId: dbUser.id,
              title: cleanTitle,
              description: cleanTitle,
              startDate: date,
              endDate: endDate.toJSDate(),
              location: undefined,
              isAllDay: false,
              rawData: {
                originalMessage: text,
                parsedResult: result,
                userTimezone: 'America/Sao_Paulo'
              }
            };
            
            const savedEvent = await storage.createEvent(insertEvent);
            console.log(`✅ Evento WhatsApp salvo no banco: ${cleanTitle} (ID: ${savedEvent.id})`);
            await reminderService.ensureDefaultReminder(savedEvent, 'whatsapp');
            
            // Integração com Google Calendar
            const settings = await storage.getUserSettings(dbUser.id);
            if (settings?.googleTokens) {
              try {
                setTokens(dbUser.id, settings.googleTokens);
                
                const eventData: any = {
                  title: cleanTitle,
                  description: cleanTitle,
                  startDate: date,
                  endDate: endDate.toJSDate(),
                };
                
                const calendarResult = await addEventToGoogleCalendar(eventData, dbUser.id);
                
                if (calendarResult?.success && calendarResult.calendarEventId) {
                  await storage.updateEvent(savedEvent.id, {
                    calendarId: calendarResult.calendarEventId,
                    conferenceLink: calendarResult.conferenceLink || undefined,
                  });
                  
                  console.log(`✅ Evento criado no Google Calendar: ${calendarResult.calendarEventId}`);
                }
              } catch (error) {
                console.error('❌ Erro ao criar evento no Google Calendar:', error);
              }
            }
          } catch (error) {
            console.error('❌ Erro ao salvar evento WhatsApp no banco:', error);
          }
        }
        
        // Verificar se tem Google Calendar conectado
        const settings = dbUser ? await storage.getUserSettings(dbUser.id) : null;
        const hasGoogleCalendar = !!(settings?.googleTokens);
        
        let response = `✅ *Evento criado!*\n\n`;
        response += `🎯 *${cleanTitle}*\n`;
        const dateTime = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        response += `📅 ${dateTime}\n\n`;
        
        if (hasGoogleCalendar) {
          response += `✅ *Criado no Google Calendar!*\n\n`;
        } else {
          response += `*Adicionar ao calendário:*\n`;
          
          const calendarLinks = generateCalendarLinks({ 
            title: cleanTitle, 
            startDate: date, 
            hour: date.getHours(), 
            minute: date.getMinutes() 
          });
          
          response += `🔗 Google Calendar: ${calendarLinks.google}\n\n`;
          response += `🔗 Outlook: ${calendarLinks.outlook}\n\n`;
          response += `💡 Use /conectar para criar eventos automaticamente no Google Calendar!`;
        }
        
        console.log(`🟢 [DEBUG] Resposta enviada`);
        await this.sendMessage(from, response);
      } else {
        const response = `👋 Olá! Sou o assistente Zelar.\n\n` +
          `Para criar um evento, envie uma mensagem como:\n` +
          `• "Reunião amanhã às 14h"\n` +
          `• "Consulta médica sexta às 10h30"\n` +
          `• "Jantar com a família domingo às 19h"\n\n` +
          `Ou envie /help para ver exemplos! 🤖`;
        await this.sendMessage(from, response);
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      const from = msg.key.remoteJid;
      if (from) {
        await this.sendMessage(from, '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
      }
    }
  }

  public async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      if (!this.sock || !this.status.isReady) {
        throw new Error('WhatsApp não está pronto');
      }

      await this.sock.sendMessage(to, { text: message });
      console.log(`📤 Mensagem enviada para ${to}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  public async initialize(): Promise<void> {
    try {
      console.log('� Inicializando WhatsApp Bot (Baileys)...');
      
      // Carregar estado de autenticação
      console.log('📁 Carregando estado de autenticação...');
      const { state, saveCreds } = await useMultiFileAuthState('whatsapp_session');
      console.log('✅ Estado carregado!');
      
      // Criar conexão Baileys
      console.log('🔗 Criando conexão Baileys...');
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 250,
        getMessage: async (key) => {
          return {
            conversation: "placeholder"
          };
        }
      });
      console.log('✅ Conexão criada!');

      // Configurar event handlers
      await this.setupEventHandlers(this.sock, saveCreds);
      
      console.log('✅ WhatsApp Bot inicializado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
      console.error('❌ Detalhes:', error instanceof Error ? error.message : String(error));
      
      this.status.isReady = false;
      this.status.isConnected = false;
      
      // Tentar reinicializar após 60 segundos
      setTimeout(() => {
        console.log('🔄 Tentando reinicializar WhatsApp Bot...');
        this.initialize();
      }, 60000);
      
      throw error;
    }
  }

  public async destroy(): Promise<void> {
    try {
      console.log('🛑 Desconectando WhatsApp Bot...');
      if (this.sock) {
        this.sock.end(undefined);
        this.sock = null;
      }
      this.status.isReady = false;
      this.status.isConnected = false;
      this.notifyStatusChange();
    } catch (error) {
      console.error('❌ Erro ao desconectar WhatsApp Bot:', error);
    }
  }

  public getStatus(): WhatsAppBotStatus {
    return { ...this.status };
  }

  public onQRCode(callback: (qr: string) => void): void {
    this.qrCodeCallbacks.add(callback);
  }

  public onStatusChange(callback: (status: WhatsAppBotStatus) => void): void {
    this.statusCallbacks.add(callback);
  }

  public removeQRCodeCallback(callback: (qr: string) => void): void {
    this.qrCodeCallbacks.delete(callback);
  }

  public removeStatusCallback(callback: (status: WhatsAppBotStatus) => void): void {
    this.statusCallbacks.delete(callback);
  }

  private notifyStatusChange(): void {
    this.statusCallbacks.forEach(callback => callback(this.getStatus()));
  }
}

// Instância singleton
let whatsappBot: WhatsAppBot | null = null;

export function getWhatsAppBot(): WhatsAppBot {
  if (!whatsappBot) {
    whatsappBot = new WhatsAppBot();
  }
  return whatsappBot;
}

export async function initializeWhatsAppBot(): Promise<WhatsAppBot> {
  const bot = getWhatsAppBot();
  await bot.initialize();
  return bot;
}

export async function destroyWhatsAppBot(): Promise<void> {
  if (whatsappBot) {
    await whatsappBot.destroy();
    whatsappBot = null;
  }
}

// Export direto da instância para compatibilidade
export { getWhatsAppBot as whatsappBot };
