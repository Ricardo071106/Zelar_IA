import pkg from 'whatsapp-web.js';
const { Client, NoAuth } = pkg;
import qrcode from 'qrcode-terminal';

console.log('🚀 Iniciando WhatsApp Business - Versão Simplificada');

const client = new Client({
    authStrategy: new NoAuth(),
    puppeteer: {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    }
});

// QR Code para conexão
client.on('qr', (qr) => {
    console.log('\n=== ESCANEIE O QR CODE ===');
    qrcode.generate(qr, {small: true});
    console.log('\nCódigo para backup:');
    console.log(qr);
    console.log('\nEscaneie com WhatsApp Business');
});

// Conexão estabelecida
client.on('ready', () => {
    console.log('\n✅ WhatsApp conectado com sucesso!');
    console.log('🤖 Bot ativo - processando mensagens');
});

// Processamento de mensagens
client.on('message', async (message) => {
    if (message.fromMe) return;
    
    const userMessage = message.body.toLowerCase();
    const userName = message._data.notifyName || 'Cliente';
    
    console.log(`📩 Mensagem de ${userName}: ${message.body}`);
    
    // Detectar eventos simples
    if (userMessage.includes('reunião') || userMessage.includes('consulta') || 
        userMessage.includes('evento') || userMessage.includes('compromisso')) {
        
        const response = `Olá ${userName}! 👋

Entendi que você quer agendar algo. 

*Para criar seu evento no calendário:*

📅 *Google Calendar:*
https://calendar.google.com/calendar/render?action=TEMPLATE&text=Evento+Zelar

📅 *Outlook:*
https://outlook.live.com/calendar/0/deeplink/compose?subject=Evento+Zelar

📅 *Apple Calendar:*
Clique para baixar arquivo ICS

_Processado automaticamente pelo Zelar Assistant_`;

        await message.reply(response);
        console.log(`✅ Resposta enviada para ${userName}`);
    } else {
        // Resposta padrão
        const response = `Olá! Sou o *Zelar Assistant* 🤖

Para agendar eventos, envie mensagens como:
• "Reunião amanhã às 14h"  
• "Consulta médica sexta-feira"
• "Evento importante na segunda"

Como posso ajudar você hoje?`;

        await message.reply(response);
    }
});

client.on('disconnected', (reason) => {
    console.log('📴 Desconectado:', reason);
});

client.initialize();