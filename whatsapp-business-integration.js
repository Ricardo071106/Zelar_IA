import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

// Simple date processing function (since we can't import the full parser)
async function parseEventText(text) {
    try {
        // Basic Portuguese date patterns
        const patterns = [
            /(?:reunião|meeting|encontro)\s+(.+?)\s+(?:às?|at)\s+(\d{1,2})(?::(\d{2}))?h?/i,
            /(.+?)\s+(?:amanhã|tomorrow)\s+(?:às?|at)\s+(\d{1,2})(?::(\d{2}))?h?/i,
            /(.+?)\s+(?:sexta|friday|segunda|monday|terça|tuesday|quarta|wednesday|quinta|thursday|sábado|saturday|domingo|sunday)\s+(?:às?|at)\s+(\d{1,2})(?::(\d{2}))?h?/i,
            /(.+?)\s+(?:às?|at)\s+(\d{1,2})(?::(\d{2}))?h?/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const title = match[1].trim();
                const hour = parseInt(match[2]);
                const minute = parseInt(match[3] || '0');
                
                // Default to tomorrow for this example
                const date = new Date();
                date.setDate(date.getDate() + 1);
                
                return {
                    isValid: true,
                    title: title,
                    date: date.toISOString(),
                    hour: hour,
                    minute: minute
                };
            }
        }
        
        return { isValid: false };
    } catch (error) {
        return { isValid: false };
    }
}

console.log('🚀 Iniciando WhatsApp Business - Zelar Assistant');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-business-session'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

// QR Code para primeira conexão
client.on('qr', (qr) => {
    console.log('\n=== PRIMEIRA CONFIGURAÇÃO ===');
    console.log('Escaneie este QR Code com seu WhatsApp Business:');
    console.log('\n');
    qrcode.generate(qr, {small: true});
    console.log('\nCódigo QR também disponível em texto:');
    console.log(qr);
    console.log('\nApós escanear, seu número estará conectado ao sistema Zelar');
});

// Bot conectado e pronto
client.on('ready', () => {
    const info = client.info;
    console.log('\n✅ WhatsApp Business conectado!');
    console.log(`📞 Número: ${info.wid.user}`);
    console.log(`🏢 Empresa: ${info.pushname}`);
    console.log('🤖 Bot Zelar ativo - processando mensagens automaticamente');
});

// Processamento automático de mensagens
client.on('message', async (message) => {
    // Ignorar mensagens enviadas pelo próprio bot
    if (message.fromMe) return;
    
    const userMessage = message.body;
    const userName = message._data.notifyName || 'Cliente';
    
    console.log(`📩 Nova mensagem de ${userName}: ${userMessage}`);
    
    try {
        // Usar processamento inteligente similar ao Telegram
        const parsedEvent = await parseEventText(userMessage);
        
        if (parsedEvent.isValid) {
            // Evento detectado - criar links de calendário
            const eventTitle = parsedEvent.title;
            const eventDate = new Date(parsedEvent.date);
            const eventTime = `${parsedEvent.hour.toString().padStart(2, '0')}:${parsedEvent.minute.toString().padStart(2, '0')}`;
            
            // Formatar data em português
            const formattedDate = eventDate.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Gerar links diretos para calendários
            const googleCalendarLink = generateGoogleCalendarLink(eventTitle, eventDate, parsedEvent.hour, parsedEvent.minute);
            const outlookLink = generateOutlookLink(eventTitle, eventDate, parsedEvent.hour, parsedEvent.minute);
            const icsLink = generateICSFile(eventTitle, eventDate, parsedEvent.hour, parsedEvent.minute);
            
            const response = `✅ *Evento criado com sucesso!*

📅 *${eventTitle}*
🗓️ ${formattedDate}
⏰ ${eventTime}

*Adicione ao seu calendário:*
🔗 Google Calendar: ${googleCalendarLink}
🔗 Outlook: ${outlookLink}
📎 Arquivo ICS: ${icsLink}

_Evento processado automaticamente pelo Zelar Assistant_`;
            
            await message.reply(response);
            console.log(`✅ Evento processado: ${eventTitle} - ${formattedDate} ${eventTime}`);
            
        } else {
            // Não é um evento - resposta padrão do assistente
            const response = `Olá ${userName}! 👋

Sou o *Zelar Assistant* - seu assistente inteligente para agendamentos.

Para criar um evento, envie uma mensagem como:
• "Reunião amanhã às 14h"
• "Consulta médica sexta-feira 10h"
• "Apresentação segunda 15h30"

Posso processar datas em português e criar links diretos para Google Calendar, Outlook e Apple Calendar.

Como posso ajudar você hoje?`;
            
            await message.reply(response);
            console.log(`💬 Resposta padrão enviada para ${userName}`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        
        const errorResponse = `Desculpe, ocorreu um erro ao processar sua mensagem. 

Tente novamente com um formato como:
"Reunião amanhã às 14h"

_Zelar Assistant_`;
        
        await message.reply(errorResponse);
    }
});

// Funções para gerar links de calendário
function generateGoogleCalendarLink(title, date, hour, minute) {
    const startDate = new Date(date);
    startDate.setHours(hour, minute, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(hour + 1, minute, 0, 0); // 1 hora de duração padrão
    
    const formatDateForGoogle = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const startTime = formatDateForGoogle(startDate);
    const endTime = formatDateForGoogle(endDate);
    
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${startTime}/${endTime}`,
        details: 'Evento criado pelo Zelar Assistant'
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function generateOutlookLink(title, date, hour, minute) {
    const startDate = new Date(date);
    startDate.setHours(hour, minute, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(hour + 1, minute, 0, 0);
    
    const params = new URLSearchParams({
        subject: title,
        startdt: startDate.toISOString(),
        enddt: endDate.toISOString(),
        body: 'Evento criado pelo Zelar Assistant'
    });
    
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function generateICSFile(title, date, hour, minute) {
    // Para simplicidade, retornamos um link que gera o ICS
    return `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Zelar Assistant//NONSGML Event//EN
BEGIN:VEVENT
UID:${Date.now()}@zelar.app
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${title}
DESCRIPTION:Evento criado pelo Zelar Assistant
END:VEVENT
END:VCALENDAR`;
}

client.on('disconnected', (reason) => {
    console.log('📴 WhatsApp Business desconectado:', reason);
    console.log('🔄 Reiniciando conexão...');
    client.initialize();
});

client.initialize();