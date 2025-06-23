/**
 * WhatsApp Zelar Bot - Versão otimizada para Replit
 * Sistema completo com API REST, auto-resposta e sessão persistente
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';
import bodyParser from 'body-parser';
import qrcode from 'qrcode-terminal';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuração do Express
const app = express();
app.use(bodyParser.json());

// Estado global
let isClientReady = false;
let qrCodeString = '';
let clientInfo = null;
let client = null;

// Função para configurar o cliente WhatsApp
async function createClient() {
    // Detectar Chromium automaticamente
    let chromiumPath;
    try {
        const { stdout } = await execAsync('which chromium');
        chromiumPath = stdout.trim();
        console.log('🔍 Chromium encontrado em:', chromiumPath);
    } catch (error) {
        console.log('⚠️ Chromium não encontrado, usando configuração padrão');
    }

    const clientConfig = {
        authStrategy: new LocalAuth({
            clientId: "zelar-whatsapp-bot",
            dataPath: "./whatsapp-session"
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
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-ipc-flooding-protection',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-first-run',
                '--disable-plugins',
                '--disable-images'
            ]
        }
    };

    // Usar Chromium se disponível
    if (chromiumPath) {
        clientConfig.puppeteer.executablePath = chromiumPath;
    }

    return new Client(clientConfig);
}

// =================== EVENTOS DO WHATSAPP ===================

async function setupClientEvents(client) {
    client.on('qr', (qr) => {
        console.log('\n🔗 QR Code gerado! Escaneie com seu WhatsApp:');
        console.log('═══════════════════════════════════════════════');
        qrcode.generate(qr, { small: true });
        console.log('═══════════════════════════════════════════════');
        console.log('📱 Como conectar:');
        console.log('1. Abra o WhatsApp no seu celular');
        console.log('2. Toque em Menu (⋮) > Dispositivos conectados');
        console.log('3. Toque em "Conectar dispositivo"');
        console.log('4. Escaneie este QR Code\n');
        qrCodeString = qr;
    });

    client.on('ready', async () => {
        try {
            clientInfo = {
                pushname: client.info.pushname,
                number: client.info.wid.user,
                platform: client.info.platform
            };
            
            console.log('✅ WhatsApp conectado com sucesso!');
            console.log(`📱 Conectado como: ${clientInfo.pushname}`);
            console.log(`📞 Número: ${clientInfo.number}`);
            console.log(`💻 Plataforma: ${clientInfo.platform}`);
            console.log('🚀 Bot Zelar está pronto para receber mensagens!\n');
            isClientReady = true;
            qrCodeString = ''; // Limpar QR Code após conexão
        } catch (error) {
            console.error('❌ Erro ao obter informações do cliente:', error.message);
            isClientReady = true; // Marcar como pronto mesmo assim
        }
    });

    client.on('authenticated', () => {
        console.log('🔐 Autenticação realizada com sucesso!');
        console.log('💾 Sessão salva - não será necessário escanear novamente');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Falha na autenticação:', msg);
        console.log('🔄 Tentando reconectar...');
        isClientReady = false;
        qrCodeString = '';
    });

    client.on('disconnected', (reason) => {
        console.log('📴 Cliente desconectado:', reason);
        isClientReady = false;
        clientInfo = null;
        console.log('🔄 Tentando reconectar em 5 segundos...');
        setTimeout(() => {
            console.log('🔄 Reiniciando cliente WhatsApp...');
            initializeWhatsApp();
        }, 5000);
    });

    // Auto-resposta para mensagens recebidas
    client.on('message', async (message) => {
        try {
            // Obter informações do contato
            const contact = await message.getContact();
            const chatName = contact.pushname || contact.number;
            const isGroup = message.from.includes('@g.us');
            
            // Log da mensagem recebida
            console.log(`📥 Mensagem ${isGroup ? 'do grupo' : 'de'} ${chatName} (${contact.number}): "${message.body}"`);
            
            // Verificar se não é uma mensagem enviada por nós e não é de grupo
            if (!message.fromMe && !isGroup) {
                try {
                    // Enviar auto-resposta
                    await message.reply('Olá, aqui é o Zelar! 🤖\n\nObrigado por entrar em contato. Sou um assistente automatizado.');
                    console.log(`📤 Auto-resposta enviada para ${chatName}: "Olá, aqui é o Zelar!"`);
                } catch (error) {
                    console.error(`❌ Erro ao enviar auto-resposta para ${chatName}:`, error.message);
                }
            } else if (isGroup) {
                console.log('📝 Mensagem de grupo - auto-resposta desabilitada');
            }
        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error.message);
        }
    });

    client.on('message_create', async (message) => {
        // Log de mensagens enviadas por nós
        if (message.fromMe) {
            try {
                const chat = await message.getChat();
                const chatName = chat.name || 'Contato';
                console.log(`📤 Mensagem enviada para ${chatName}: "${message.body}"`);
            } catch (error) {
                console.log(`📤 Mensagem enviada: "${message.body}"`);
            }
        }
    });
}

// =================== API REST ===================

// Endpoint para verificar status detalhado
app.get('/status', (req, res) => {
    res.json({
        success: true,
        status: isClientReady ? 'connected' : 'disconnected',
        clientInfo: clientInfo,
        hasQR: !!qrCodeString,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Endpoint para obter QR Code
app.get('/qr', (req, res) => {
    if (isClientReady) {
        res.json({
            success: true,
            message: 'WhatsApp já está conectado',
            connected: true,
            clientInfo: clientInfo
        });
    } else if (qrCodeString) {
        res.json({
            success: true,
            qrCode: qrCodeString,
            connected: false,
            message: 'Escaneie o QR Code para conectar'
        });
    } else {
        res.json({
            success: false,
            message: 'QR Code ainda não foi gerado. Aguarde...',
            connected: false
        });
    }
});

// Endpoint para enviar mensagem
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    
    // Validação dos parâmetros
    if (!number || !message) {
        return res.status(400).json({
            success: false,
            error: 'Parâmetros "number" e "message" são obrigatórios',
            example: {
                number: "5511999999999",
                message: "Olá do Zelar!"
            }
        });
    }
    
    // Verificar se o cliente está conectado
    if (!isClientReady || !client) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp não está conectado',
            message: 'Escaneie o QR Code primeiro ou aguarde a reconexão'
        });
    }
    
    try {
        // Formatar número para o formato do WhatsApp
        let formattedNumber = number.toString().replace(/\D/g, '');
        
        // Adicionar código do país se não tiver (assumindo Brasil)
        if (!formattedNumber.startsWith('55') && formattedNumber.length === 11) {
            formattedNumber = '55' + formattedNumber;
        }
        
        const chatId = formattedNumber + '@c.us';
        
        console.log(`📤 Tentando enviar mensagem para ${formattedNumber}: "${message}"`);
        
        // Verificar se o número existe no WhatsApp
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            console.log(`⚠️ Número ${formattedNumber} não está registrado no WhatsApp`);
            return res.status(400).json({
                success: false,
                error: 'Número não está registrado no WhatsApp',
                number: formattedNumber
            });
        }
        
        // Enviar mensagem
        const sentMessage = await client.sendMessage(chatId, message);
        
        console.log(`✅ Mensagem enviada com sucesso para ${formattedNumber}`);
        
        res.json({
            success: true,
            message: 'Mensagem enviada com sucesso',
            to: formattedNumber,
            content: message,
            messageId: sentMessage.id.id,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${number}:`, error.message);
        
        res.status(500).json({
            success: false,
            error: 'Erro interno ao enviar mensagem',
            details: error.message,
            to: number
        });
    }
});

// Endpoint para obter informações do cliente
app.get('/info', (req, res) => {
    if (!isClientReady || !clientInfo) {
        return res.status(503).json({
            success: false,
            error: 'Cliente não está conectado'
        });
    }

    res.json({
        success: true,
        clientInfo: clientInfo,
        status: 'connected',
        timestamp: new Date().toISOString()
    });
});

// Endpoint para reiniciar conexão
app.post('/restart', async (req, res) => {
    try {
        console.log('🔄 Reinicializando cliente WhatsApp...');
        
        if (client) {
            await client.destroy();
        }
        
        isClientReady = false;
        qrCodeString = '';
        clientInfo = null;
        
        // Reinicializar após um pequeno delay
        setTimeout(() => {
            initializeWhatsApp();
        }, 2000);
        
        res.json({
            success: true,
            message: 'Cliente reiniciado. Aguarde a reconexão.',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao reiniciar cliente:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao reiniciar cliente',
            details: error.message
        });
    }
});

// =================== INICIALIZAÇÃO ===================

async function initializeWhatsApp() {
    try {
        console.log('🚀 Criando cliente WhatsApp...');
        client = await createClient();
        await setupClientEvents(client);
        console.log('🔄 Inicializando cliente WhatsApp...');
        await client.initialize();
    } catch (error) {
        console.error('❌ Erro ao inicializar WhatsApp:', error.message);
        console.log('🔄 Tentando novamente em 10 segundos...');
        setTimeout(initializeWhatsApp, 10000);
    }
}

// Inicializar servidor Express
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor WhatsApp Zelar iniciado!');
    console.log(`📡 Porta: ${PORT}`);
    console.log('📋 Endpoints disponíveis:');
    console.log(`   GET  /status - Status da conexão`);
    console.log(`   GET  /qr - Obter QR Code`);
    console.log(`   GET  /info - Informações do cliente`);
    console.log(`   POST /send-message - Enviar mensagem`);
    console.log(`   POST /restart - Reiniciar conexão`);
    console.log('\n💡 Exemplo de uso:');
    console.log(`curl -X POST http://localhost:${PORT}/send-message \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"number": "5511999999999", "message": "Olá do Zelar!"}'`);
    console.log('\n🔄 Inicializando WhatsApp...\n');
    
    // Inicializar WhatsApp
    initializeWhatsApp();
});

// Tratamento de encerramento limpo
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando aplicação...');
    if (client) {
        await client.destroy();
    }
    process.exit();
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Encerrando aplicação...');
    if (client) {
        await client.destroy();
    }
    process.exit();
});

export default app;