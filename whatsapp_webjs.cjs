const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

console.log('🚀 WhatsApp Bot - Usando whatsapp-web.js...');

// Criar cliente com autenticação local
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "zelar-bot",
        dataPath: "./whatsapp_session"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Evento quando QR code é gerado
client.on('qr', (qr) => {
    console.log('\n📱 QR CODE WHATSAPP (whatsapp-web.js):');
    qrcode.generate(qr, { small: true });
    console.log('\n🔸 Escaneie o código acima no WhatsApp');
    console.log('⏳ Aguardando conexão...\n');
    
    // Salvar QR como arquivo também
    const QRCode = require('qrcode');
    QRCode.toFile('whatsapp_webjs_qr.png', qr, {
        width: 300,
        margin: 2
    }).then(() => {
        console.log('💾 QR Code salvo como: whatsapp_webjs_qr.png');
    }).catch(err => {
        console.error('Erro ao salvar QR:', err);
    });
});

// Evento quando cliente está pronto
client.on('ready', () => {
    console.log('✅ CLIENTE WHATSAPP CONECTADO!');
    console.log('🤖 Bot está pronto para receber mensagens!');
});

// Evento quando cliente é autenticado
client.on('authenticated', () => {
    console.log('🔐 Cliente autenticado com sucesso!');
});

// Evento quando autenticação falha
client.on('auth_failure', msg => {
    console.error('❌ Falha na autenticação:', msg);
});

// Evento quando cliente desconecta
client.on('disconnected', (reason) => {
    console.log('❌ Cliente desconectado:', reason);
    console.log('🔄 Tentando reconectar...');
});

// Evento para mensagens recebidas
client.on('message_create', async (message) => {
    if (message.fromMe) return; // Ignorar mensagens enviadas pelo bot
    
    console.log(`📩 Mensagem de ${message.from}: ${message.body}`);
    
    // Resposta de teste
    if (message.body.toLowerCase().includes('oi') || message.body.toLowerCase().includes('olá')) {
        await message.reply('👋 Olá! Bot WhatsApp Zelar funcionando com whatsapp-web.js!');
    }
});

// Capturar erros
client.on('error', (error) => {
    console.error('❌ Erro no cliente:', error);
});

// Inicializar cliente
console.log('🔄 Inicializando cliente WhatsApp...');
client.initialize();

// Tratamento de encerramento
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando bot...');
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Encerrando bot...');
    await client.destroy();
    process.exit(0);
});