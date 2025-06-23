import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, BusinessContact } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';

// Configuração do Express
const app = express();
app.use(express.json());

// Estado do cliente WhatsApp Business
let whatsappClient = null;
let isConnected = false;
let qrCodeData = null;

// Configuração específica para WhatsApp Business
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-business-session',
        clientId: 'business-client'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--single-process'
        ]
    },
    // Configurações específicas para Business
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

console.log('🚀 Iniciando WhatsApp Business Bot Zelar...');
console.log('📱 Configurado para contas WhatsApp Business');

// Eventos do cliente
client.on('qr', (qr) => {
    console.log('\n🔗 QR Code gerado! Escaneie com seu WhatsApp Business:');
    console.log('WhatsApp Business → Menu (⋮) → Dispositivos conectados → Conectar dispositivo\n');
    
    qrCodeData = qr;
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Business conectado com sucesso!');
    isConnected = true;
    qrCodeData = null;
    
    const info = client.info;
    console.log(`📋 Conta conectada: ${info.pushname}`);
    console.log(`📞 Número: ${info.wid.user}`);
    
    // Verificar se é uma conta Business
    if (info.isBusiness) {
        console.log('🏢 Conta WhatsApp Business detectada!');
        console.log(`🏪 Nome da empresa: ${info.businessProfile?.description || 'Não informado'}`);
    } else {
        console.log('⚠️ Esta não é uma conta WhatsApp Business');
        console.log('💡 Para recursos Business completos, use uma conta WhatsApp Business');
    }
    
    whatsappClient = client;
});

client.on('message', async (message) => {
    console.log(`📩 Mensagem recebida de ${message.from}: ${message.body}`);
    
    // Resposta automática para WhatsApp Business
    if (!message.fromMe) {
        try {
            const businessResponse = `🏢 *Olá! Bem-vindo ao Zelar Business!*

Sou seu assistente inteligente para agendamentos. Posso ajudar você a:

📅 *Criar eventos* - "Reunião amanhã às 14h"
🔔 *Configurar lembretes* - "Lembrar consulta sexta 10h"
📋 *Gerenciar agenda* - "/agenda"
🗓️ *Links diretos* para Google Calendar e Outlook

Como posso ajudar sua empresa hoje?`;

            await message.reply(businessResponse);
            console.log('✅ Resposta Business enviada');
        } catch (error) {
            console.error('❌ Erro ao enviar resposta:', error);
        }
    }
});

client.on('authenticated', () => {
    console.log('🔐 Autenticação realizada com sucesso');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
    isConnected = false;
});

client.on('disconnected', (reason) => {
    console.log('📴 WhatsApp Business desconectado:', reason);
    isConnected = false;
    whatsappClient = null;
});

// Inicializar cliente
client.initialize();

// Rotas da API
app.get('/', (req, res) => {
    res.json({
        service: 'WhatsApp Business Bot Zelar',
        status: isConnected ? 'Conectado' : 'Desconectado',
        timestamp: new Date().toISOString(),
        business: true,
        endpoints: {
            status: 'GET /status',
            send: 'POST /send',
            business: 'GET /business-info'
        }
    });
});

app.get('/status', (req, res) => {
    res.json({
        status: isConnected ? 'Conectado' : 'Desconectado',
        timestamp: new Date().toISOString(),
        qrCode: qrCodeData,
        business: true,
        clientInfo: whatsappClient ? {
            isReady: whatsappClient.info ? true : false,
            isBusiness: whatsappClient.info?.isBusiness || false,
            pushname: whatsappClient.info?.pushname || null
        } : null
    });
});

app.get('/business-info', async (req, res) => {
    if (!isConnected || !whatsappClient) {
        return res.status(400).json({
            success: false,
            error: 'WhatsApp Business não conectado'
        });
    }

    try {
        const info = whatsappClient.info;
        const businessInfo = {
            isBusiness: info.isBusiness,
            businessProfile: info.businessProfile || null,
            pushname: info.pushname,
            number: info.wid.user,
            platform: info.platform
        };

        res.json({
            success: true,
            business: businessInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao obter informações Business'
        });
    }
});

app.post('/send', async (req, res) => {
    const { number, message } = req.body;

    if (!isConnected || !whatsappClient) {
        return res.status(400).json({
            success: false,
            error: 'WhatsApp Business não conectado'
        });
    }

    if (!number || !message) {
        return res.status(400).json({
            success: false,
            error: 'Número e mensagem são obrigatórios'
        });
    }

    try {
        const chatId = number.includes('@') ? number : `${number}@c.us`;
        await whatsappClient.sendMessage(chatId, message);
        
        console.log(`✅ Mensagem Business enviada para ${number}: ${message}`);
        
        res.json({
            success: true,
            message: 'Mensagem Business enviada com sucesso',
            to: number,
            content: message,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem Business:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao enviar mensagem Business'
        });
    }
});

// Iniciar servidor
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n🌐 Servidor WhatsApp Business rodando na porta ${PORT}`);
    console.log(`📍 Acesse: http://localhost:${PORT}`);
    console.log(`📤 API de envio: POST http://localhost:${PORT}/send`);
    console.log(`🏢 Info Business: GET http://localhost:${PORT}/business-info`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Rejeição não tratada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exceção não capturada:', error);
    process.exit(1);
});