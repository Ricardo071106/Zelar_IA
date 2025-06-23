/**
 * WhatsApp Server - Implementação robusta para Replit
 * Sistema completo com persistência de sessão e API REST
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

// Estado global
let client = null;
let isReady = false;
let qrString = '';
let clientData = null;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 3;

// Diretório para sessão
const sessionDir = './whatsapp-session';

// Garantir que diretório existe
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

// Configuração do cliente
function createWhatsAppClient() {
    return new Client({
        authStrategy: new LocalAuth({
            clientId: "zelar-bot",
            dataPath: sessionDir
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
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        }
    });
}

// Configurar eventos do cliente
function setupEvents(client) {
    client.on('qr', (qr) => {
        console.log('\n📱 QR Code gerado:');
        console.log('================================');
        qrcode.generate(qr, { small: true });
        console.log('================================');
        console.log('Escaneie com WhatsApp > Menu > Dispositivos conectados\n');
        qrString = qr;
    });

    client.on('ready', async () => {
        try {
            const info = client.info;
            clientData = {
                name: info.pushname || 'WhatsApp User',
                number: info.wid.user,
                platform: info.platform || 'unknown'
            };
            
            isReady = true;
            qrString = '';
            connectionAttempts = 0;
            
            console.log('✅ WhatsApp conectado!');
            console.log(`Nome: ${clientData.name}`);
            console.log(`Número: ${clientData.number}`);
            console.log('Bot Zelar está ativo!\n');
        } catch (error) {
            console.log('✅ WhatsApp conectado (info limitada)');
            isReady = true;
        }
    });

    client.on('authenticated', () => {
        console.log('🔐 Sessão autenticada e salva');
    });

    client.on('auth_failure', () => {
        console.log('❌ Falha na autenticação');
        handleReconnection();
    });

    client.on('disconnected', () => {
        console.log('📴 Desconectado');
        isReady = false;
        clientData = null;
        handleReconnection();
    });

    // Auto-resposta
    client.on('message', async (msg) => {
        if (!msg.fromMe && !msg.from.includes('@g.us')) {
            try {
                const contact = await msg.getContact();
                const name = contact.pushname || contact.number;
                
                console.log(`📥 Mensagem de ${name}: "${msg.body}"`);
                
                await msg.reply('Olá, aqui é o Zelar!');
                console.log(`📤 Auto-resposta enviada para ${name}`);
            } catch (error) {
                console.log('❌ Erro na auto-resposta:', error.message);
            }
        }
    });
}

// Reconexão automática
function handleReconnection() {
    if (connectionAttempts < MAX_ATTEMPTS) {
        connectionAttempts++;
        console.log(`🔄 Tentativa ${connectionAttempts}/${MAX_ATTEMPTS} em 5s...`);
        setTimeout(() => {
            initializeClient();
        }, 5000);
    } else {
        console.log('❌ Máximo de tentativas atingido. Use /restart para tentar novamente.');
    }
}

// Inicializar cliente
async function initializeClient() {
    try {
        if (client) {
            await client.destroy();
        }
        
        client = createWhatsAppClient();
        setupEvents(client);
        
        console.log('🚀 Inicializando WhatsApp...');
        await client.initialize();
    } catch (error) {
        console.log('❌ Erro na inicialização:', error.message);
        handleReconnection();
    }
}

// =================== API ENDPOINTS ===================

// Status
app.get('/status', (req, res) => {
    res.json({
        connected: isReady,
        hasQR: !!qrString,
        client: clientData,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString()
    });
});

// QR Code
app.get('/qr', (req, res) => {
    if (isReady) {
        res.json({
            success: true,
            message: 'Já conectado',
            client: clientData
        });
    } else if (qrString) {
        res.json({
            success: true,
            qr: qrString,
            message: 'Escaneie o QR Code'
        });
    } else {
        res.json({
            success: false,
            message: 'Aguardando QR Code...'
        });
    }
});

// Enviar mensagem
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    
    if (!number || !message) {
        return res.status(400).json({
            success: false,
            error: 'Campos obrigatórios: number, message'
        });
    }
    
    if (!isReady) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp não conectado'
        });
    }
    
    try {
        // Formatar número
        let cleanNumber = number.toString().replace(/\D/g, '');
        
        // Adicionar código do país se necessário
        if (cleanNumber.length === 11 && !cleanNumber.startsWith('55')) {
            cleanNumber = '55' + cleanNumber;
        }
        
        const chatId = cleanNumber + '@c.us';
        
        console.log(`📤 Enviando para ${cleanNumber}: "${message}"`);
        
        // Verificar se número existe
        const exists = await client.isRegisteredUser(chatId);
        if (!exists) {
            return res.status(400).json({
                success: false,
                error: 'Número não registrado no WhatsApp'
            });
        }
        
        // Enviar mensagem
        await client.sendMessage(chatId, message);
        
        console.log(`✅ Mensagem enviada para ${cleanNumber}`);
        
        res.json({
            success: true,
            message: 'Mensagem enviada',
            to: cleanNumber,
            content: message
        });
        
    } catch (error) {
        console.log(`❌ Erro ao enviar: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Reiniciar
app.post('/restart', async (req, res) => {
    console.log('🔄 Reiniciando...');
    
    isReady = false;
    qrString = '';
    clientData = null;
    connectionAttempts = 0;
    
    res.json({
        success: true,
        message: 'Reiniciando conexão...'
    });
    
    setTimeout(() => {
        initializeClient();
    }, 1000);
});

// =================== SERVIDOR ===================

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor WhatsApp rodando na porta ${PORT}`);
    console.log('📋 Endpoints:');
    console.log('  GET  /status');
    console.log('  GET  /qr');
    console.log('  POST /send-message');
    console.log('  POST /restart');
    console.log('\n💡 Teste:');
    console.log(`curl http://localhost:${PORT}/status`);
    console.log('\n🔄 Iniciando WhatsApp...\n');
    
    // Iniciar WhatsApp
    initializeClient();
});

// Encerramento limpo
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando...');
    if (client) {
        await client.destroy();
    }
    process.exit();
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Encerrando...');
    if (client) {
        await client.destroy();
    }
    process.exit();
});