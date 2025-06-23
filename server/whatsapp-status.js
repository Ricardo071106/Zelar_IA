import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';

const app = express();
const PORT = 3001;

let whatsappClient = null;
let connectionStatus = {
    isConnected: false,
    phoneNumber: null,
    businessName: null,
    qrCode: null,
    lastActivity: null,
    messagesProcessed: 0
};

// Initialize WhatsApp client
function initializeWhatsApp() {
    whatsappClient = new Client({
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

    whatsappClient.on('qr', (qr) => {
        console.log('📱 QR Code gerado para WhatsApp Business');
        connectionStatus.qrCode = qr;
        connectionStatus.isConnected = false;
    });

    whatsappClient.on('ready', () => {
        const info = whatsappClient.info;
        console.log('✅ WhatsApp Business conectado');
        console.log(`📞 Número: ${info.wid.user}`);
        
        connectionStatus.isConnected = true;
        connectionStatus.phoneNumber = info.wid.user;
        connectionStatus.businessName = info.pushname;
        connectionStatus.qrCode = null;
        connectionStatus.lastActivity = new Date().toISOString();
    });

    whatsappClient.on('message', async (message) => {
        if (message.fromMe) return;
        
        connectionStatus.messagesProcessed++;
        connectionStatus.lastActivity = new Date().toISOString();
        
        console.log(`📩 Mensagem processada: ${message.body}`);
    });

    whatsappClient.on('disconnected', () => {
        console.log('📴 WhatsApp Business desconectado');
        connectionStatus.isConnected = false;
        connectionStatus.phoneNumber = null;
        connectionStatus.businessName = null;
    });

    whatsappClient.initialize();
}

// API Routes
app.use(express.json());

app.get('/status', (req, res) => {
    res.json({
        success: true,
        status: connectionStatus
    });
});

app.get('/business-info', (req, res) => {
    res.json({
        success: true,
        isConnected: connectionStatus.isConnected,
        phoneNumber: connectionStatus.phoneNumber,
        businessName: connectionStatus.businessName,
        messagesProcessed: connectionStatus.messagesProcessed,
        lastActivity: connectionStatus.lastActivity
    });
});

app.post('/restart', (req, res) => {
    if (whatsappClient) {
        whatsappClient.destroy();
    }
    
    setTimeout(() => {
        initializeWhatsApp();
    }, 2000);
    
    res.json({
        success: true,
        message: 'WhatsApp Business reiniciado'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 WhatsApp Business Status Server rodando na porta ${PORT}`);
    initializeWhatsApp();
});

export { connectionStatus };