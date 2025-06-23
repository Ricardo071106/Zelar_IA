/**
 * WhatsApp Bot usando whatsapp-web.js
 * Sistema completo com API REST e auto-resposta
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';
import bodyParser from 'body-parser';
import qrcode from 'qrcode-terminal';

// Configuração do Express
const app = express();
app.use(bodyParser.json());

// Configuração do cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "zelar-whatsapp"
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

let isClientReady = false;
let qrCodeString = '';

// =================== EVENTOS DO WHATSAPP ===================

client.on('qr', (qr) => {
    console.log('\n🔗 QR Code gerado! Escaneie com seu WhatsApp:');
    console.log('═══════════════════════════════════════════════');
    qrcode.generate(qr, { small: true });
    console.log('═══════════════════════════════════════════════');
    console.log('📱 Abra o WhatsApp > Menu > Dispositivos conectados > Conectar dispositivo');
    qrCodeString = qr;
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
    console.log(`📱 Conectado como: ${client.info.pushname}`);
    console.log(`📞 Número: ${client.info.wid.user}`);
    console.log('🚀 Bot está pronto para receber mensagens!\n');
    isClientReady = true;
});

client.on('authenticated', () => {
    console.log('🔐 Autenticação realizada com sucesso!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
    console.log('📴 Cliente desconectado:', reason);
    isClientReady = false;
});

// Auto-resposta para mensagens recebidas
client.on('message', async (message) => {
    // Log da mensagem recebida
    const contact = await message.getContact();
    const chatName = contact.pushname || contact.number;
    
    console.log(`📥 Mensagem recebida de ${chatName} (${contact.number}): "${message.body}"`);
    
    // Verificar se não é uma mensagem enviada por nós
    if (!message.fromMe) {
        try {
            // Enviar auto-resposta
            await message.reply('Olá, aqui é o Zelar!');
            console.log(`📤 Auto-resposta enviada para ${chatName}: "Olá, aqui é o Zelar!"`);
        } catch (error) {
            console.error(`❌ Erro ao enviar auto-resposta para ${chatName}:`, error.message);
        }
    }
});

// =================== API REST ===================

// Endpoint para verificar status
app.get('/status', (req, res) => {
    res.json({
        status: isClientReady ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        qrCode: qrCodeString || null
    });
});

// Endpoint para enviar mensagem
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    
    // Validação dos parâmetros
    if (!number || !message) {
        return res.status(400).json({
            success: false,
            error: 'Parâmetros "number" e "message" são obrigatórios'
        });
    }
    
    // Verificar se o cliente está conectado
    if (!isClientReady) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp não está conectado. Escaneie o QR Code primeiro.'
        });
    }
    
    try {
        // Formatar número para o formato do WhatsApp
        let formattedNumber = number.toString().replace(/\D/g, '');
        
        // Adicionar código do país se não tiver
        if (!formattedNumber.startsWith('55') && formattedNumber.length === 11) {
            formattedNumber = '55' + formattedNumber;
        }
        
        const chatId = formattedNumber + '@c.us';
        
        console.log(`📤 Enviando mensagem para ${formattedNumber}: "${message}"`);
        
        // Verificar se o número existe
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            console.log(`⚠️  Número ${formattedNumber} não está registrado no WhatsApp`);
            return res.status(400).json({
                success: false,
                error: 'Número não está registrado no WhatsApp'
            });
        }
        
        // Enviar mensagem
        await client.sendMessage(chatId, message);
        
        console.log(`✅ Mensagem enviada com sucesso para ${formattedNumber}`);
        
        res.json({
            success: true,
            message: 'Mensagem enviada com sucesso',
            to: formattedNumber,
            content: message,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${number}:`, error.message);
        
        res.status(500).json({
            success: false,
            error: 'Erro interno ao enviar mensagem',
            details: error.message
        });
    }
});

// Endpoint para obter QR Code
app.get('/qr', (req, res) => {
    if (isClientReady) {
        res.json({
            success: true,
            message: 'WhatsApp já está conectado',
            connected: true
        });
    } else {
        res.json({
            success: true,
            qrCode: qrCodeString,
            connected: false,
            message: 'Escaneie o QR Code para conectar'
        });
    }
});

// =================== INICIALIZAÇÃO ===================

const PORT = process.env.PORT || 3000;

// Inicializar cliente WhatsApp
console.log('🚀 Iniciando cliente WhatsApp...');
client.initialize();

// Inicializar servidor Express
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor API iniciado na porta ${PORT}`);
    console.log(`📡 Endpoints disponíveis:`);
    console.log(`   GET  /status - Status da conexão`);
    console.log(`   GET  /qr - Obter QR Code`);
    console.log(`   POST /send-message - Enviar mensagem`);
    console.log('\n📋 Exemplo de uso da API:');
    console.log(`curl -X POST http://localhost:${PORT}/send-message \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"number": "5511999999999", "message": "Olá do Zelar!"}'`);
    console.log('\n⏳ Aguardando QR Code...\n');
});

// Tratamento de encerramento
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando aplicação...');
    await client.destroy();
    process.exit();
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Encerrando aplicação...');
    await client.destroy();
    process.exit();
});