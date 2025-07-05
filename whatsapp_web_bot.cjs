const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

console.log('🚀 Iniciando WhatsApp Web Bot...');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "zelar-bot"
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

let isConnected = false;

// Evento QR Code
client.on('qr', (qr) => {
    console.log('\n📱 QR CODE PARA WHATSAPP WEB:');
    
    // Mostrar QR no terminal
    qrcode.generate(qr, { small: false });
    
    // Salvar QR em arquivo
    fs.writeFileSync('whatsapp_web_qr.txt', qr);
    
    console.log('\n🔸 INSTRUÇÕES:');
    console.log('1️⃣ Abra WhatsApp no celular');
    console.log('2️⃣ Menu (3 pontos) → WhatsApp Web');
    console.log('3️⃣ Escanear código → Aponte para o QR acima');
    console.log('4️⃣ Aguarde a conexão...');
    console.log('\n💾 QR também salvo em: whatsapp_web_qr.txt');
});

// Evento de conexão
client.on('ready', () => {
    isConnected = true;
    console.log('\n✅ WHATSAPP WEB CONECTADO!');
    console.log('🤖 Zelar Bot ativo no WhatsApp Web!');
    console.log('📱 Envie mensagens sobre eventos para testar...');
});

// Evento de mensagem
client.on('message', async (message) => {
    // Ignorar mensagens próprias
    if (message.fromMe) return;
    
    const text = message.body;
    console.log(`📩 Mensagem recebida: "${text}"`);
    
    // Palavras-chave para detectar eventos
    const eventKeywords = [
        'reunião', 'evento', 'compromisso', 'dentista', 'médico', 
        'consulta', 'encontro', 'almoço', 'jantar', 'apresentação',
        'entrevista', 'workshop', 'seminário', 'curso', 'conferência',
        'meeting', 'appointment', 'doctor', 'lunch', 'dinner'
    ];
    
    const isEvent = eventKeywords.some(keyword => 
        text.toLowerCase().includes(keyword)
    );
    
    if (isEvent) {
        console.log('🎯 Evento detectado! Processando...');
        
        const eventTitle = text.trim();
        const response = `✅ *Evento processado pelo Zelar Bot!*

📅 *"${eventTitle}"*

🔗 *Adicionar ao calendário:*

📱 *Google Calendar:*
https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}

💻 *Outlook:*  
https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventTitle)}

🍎 *Apple Calendar:*
Copie: ${eventTitle}

🤖 *Zelar Bot* - Assistente Inteligente
✨ WhatsApp Web Integration`;
        
        try {
            await message.reply(response);
            console.log('✅ Resposta enviada com links!');
        } catch (error) {
            console.log('❌ Erro ao enviar:', error.message);
        }
    }
});

// Evento de desconexão
client.on('disconnected', (reason) => {
    isConnected = false;
    console.log('❌ Desconectado:', reason);
    console.log('🔄 Reiniciando...');
});

// Evento de erro de autenticação
client.on('auth_failure', (msg) => {
    console.log('❌ Falha na autenticação:', msg);
});

// Inicializar cliente
console.log('🔄 Inicializando WhatsApp Web...');
client.initialize();

// Status periódico
setInterval(() => {
    if (isConnected) {
        console.log('💚 WhatsApp Web ativo - ' + new Date().toLocaleTimeString());
    }
}, 60000);

// Tratamento de sinais
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