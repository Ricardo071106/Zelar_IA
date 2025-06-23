/**
 * WhatsApp Simulation Server - Para desenvolvimento e testes
 * Simula a funcionalidade do WhatsApp Web com API completa
 */

import express from 'express';
import qrcode from 'qrcode-terminal';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Estado da simulação
let isConnected = false;
let qrString = '';
let sessionData = null;
let messageHistory = [];
let autoResponseEnabled = true;

// Simular dados do cliente
const clientInfo = {
    name: "Usuário Zelar",
    number: "5511999999999",
    platform: "web",
    connected_at: null
};

// Gerar QR Code simulado
function generateQRCode() {
    const qrData = `whatsapp-web-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    qrString = qrData;
    
    console.log('\n📱 QR Code simulado gerado:');
    console.log('================================');
    qrcode.generate(qrData, { small: true });
    console.log('================================');
    console.log('Para simular conexão, faça: POST /simulate-scan\n');
    
    // Auto-conectar após 30 segundos se não for escaneado
    setTimeout(() => {
        if (!isConnected && qrString === qrData) {
            console.log('⏰ Simulando escaneamento automático...');
            simulateConnection();
        }
    }, 30000);
}

// Simular conexão
function simulateConnection() {
    isConnected = true;
    qrString = '';
    clientInfo.connected_at = new Date().toISOString();
    
    console.log('✅ WhatsApp simulado conectado!');
    console.log(`📱 Conectado como: ${clientInfo.name}`);
    console.log(`📞 Número: ${clientInfo.number}`);
    console.log('🚀 Bot Zelar está ativo (simulação)!\n');
}

// Simular recebimento de mensagem
function simulateIncomingMessage(from, message) {
    const msgData = {
        id: crypto.randomBytes(8).toString('hex'),
        from: from,
        message: message,
        timestamp: new Date().toISOString(),
        fromMe: false
    };
    
    messageHistory.push(msgData);
    console.log(`📥 Mensagem simulada de ${from}: "${message}"`);
    
    // Auto-resposta
    if (autoResponseEnabled) {
        setTimeout(() => {
            const response = "Olá, aqui é o Zelar!";
            const responseData = {
                id: crypto.randomBytes(8).toString('hex'),
                from: from,
                message: response,
                timestamp: new Date().toISOString(),
                fromMe: true
            };
            
            messageHistory.push(responseData);
            console.log(`📤 Auto-resposta enviada para ${from}: "${response}"`);
        }, 1000);
    }
}

// =================== API ENDPOINTS ===================

// Status da conexão
app.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        hasQR: !!qrString,
        client: isConnected ? clientInfo : null,
        messageCount: messageHistory.length,
        autoResponse: autoResponseEnabled,
        timestamp: new Date().toISOString(),
        mode: 'simulation'
    });
});

// Obter QR Code
app.get('/qr', (req, res) => {
    if (isConnected) {
        res.json({
            success: true,
            message: 'WhatsApp já conectado (simulação)',
            client: clientInfo
        });
    } else if (qrString) {
        res.json({
            success: true,
            qr: qrString,
            message: 'Escaneie o QR Code ou use POST /simulate-scan'
        });
    } else {
        res.json({
            success: false,
            message: 'Gerando QR Code...'
        });
    }
});

// Simular escaneamento do QR
app.post('/simulate-scan', (req, res) => {
    if (isConnected) {
        return res.json({
            success: false,
            message: 'Já conectado'
        });
    }
    
    if (!qrString) {
        return res.json({
            success: false,
            message: 'Nenhum QR Code disponível'
        });
    }
    
    simulateConnection();
    
    res.json({
        success: true,
        message: 'Conexão simulada com sucesso',
        client: clientInfo
    });
});

// Enviar mensagem
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    
    if (!number || !message) {
        return res.status(400).json({
            success: false,
            error: 'Campos obrigatórios: number, message',
            example: {
                number: "5511999999999",
                message: "Olá do Zelar!"
            }
        });
    }
    
    if (!isConnected) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp não conectado (simulação)'
        });
    }
    
    // Formatar número
    let cleanNumber = number.toString().replace(/\D/g, '');
    
    if (cleanNumber.length === 11 && !cleanNumber.startsWith('55')) {
        cleanNumber = '55' + cleanNumber;
    }
    
    // Simular envio
    const msgData = {
        id: crypto.randomBytes(8).toString('hex'),
        to: cleanNumber,
        message: message,
        timestamp: new Date().toISOString(),
        fromMe: true,
        status: 'sent'
    };
    
    messageHistory.push(msgData);
    
    console.log(`📤 Mensagem simulada enviada para ${cleanNumber}: "${message}"`);
    
    // Simular resposta automática do destinatário (50% de chance)
    if (Math.random() > 0.5) {
        setTimeout(() => {
            const responses = [
                "Oi! Obrigado pela mensagem.",
                "Olá! Como posso ajudar?",
                "Recebido, muito obrigado!",
                "Oi! Tudo bem?",
                "Obrigado pelo contato!"
            ];
            
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            simulateIncomingMessage(cleanNumber, randomResponse);
        }, 2000 + Math.random() * 3000);
    }
    
    res.json({
        success: true,
        message: 'Mensagem enviada (simulação)',
        to: cleanNumber,
        content: message,
        messageId: msgData.id,
        timestamp: msgData.timestamp
    });
});

// Histórico de mensagens
app.get('/messages', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const messages = messageHistory.slice(-limit).reverse();
    
    res.json({
        success: true,
        messages: messages,
        total: messageHistory.length,
        limit: limit
    });
});

// Simular mensagem recebida
app.post('/simulate-incoming', (req, res) => {
    const { from, message } = req.body;
    
    if (!from || !message) {
        return res.status(400).json({
            success: false,
            error: 'Campos obrigatórios: from, message'
        });
    }
    
    if (!isConnected) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp não conectado'
        });
    }
    
    simulateIncomingMessage(from, message);
    
    res.json({
        success: true,
        message: 'Mensagem recebida simulada',
        from: from,
        content: message
    });
});

// Configurar auto-resposta
app.post('/auto-response', (req, res) => {
    const { enabled } = req.body;
    
    autoResponseEnabled = enabled !== false;
    
    res.json({
        success: true,
        autoResponse: autoResponseEnabled,
        message: `Auto-resposta ${autoResponseEnabled ? 'ativada' : 'desativada'}`
    });
});

// Reiniciar simulação
app.post('/restart', (req, res) => {
    console.log('🔄 Reiniciando simulação...');
    
    isConnected = false;
    qrString = '';
    messageHistory = [];
    clientInfo.connected_at = null;
    
    res.json({
        success: true,
        message: 'Simulação reiniciada'
    });
    
    // Gerar novo QR após restart
    setTimeout(() => {
        generateQRCode();
    }, 2000);
});

// Limpar histórico
app.delete('/messages', (req, res) => {
    const count = messageHistory.length;
    messageHistory = [];
    
    res.json({
        success: true,
        message: `${count} mensagens removidas`,
        cleared: count
    });
});

// =================== SERVIDOR ===================

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor WhatsApp Simulação rodando na porta', PORT);
    console.log('📋 Endpoints disponíveis:');
    console.log('  GET  /status - Status da conexão');
    console.log('  GET  /qr - Obter QR Code');
    console.log('  POST /simulate-scan - Simular escaneamento');
    console.log('  POST /send-message - Enviar mensagem');
    console.log('  GET  /messages - Histórico de mensagens');
    console.log('  POST /simulate-incoming - Simular mensagem recebida');
    console.log('  POST /auto-response - Configurar auto-resposta');
    console.log('  POST /restart - Reiniciar simulação');
    console.log('  DELETE /messages - Limpar histórico');
    
    console.log('\n💡 Exemplos de uso:');
    console.log(`curl http://localhost:${PORT}/status`);
    console.log(`curl -X POST http://localhost:${PORT}/send-message \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"number": "5511999999999", "message": "Olá!"}'`);
    
    console.log('\n🎭 Modo: SIMULAÇÃO COMPLETA');
    console.log('✅ Todas as funcionalidades disponíveis sem dependências externas');
    console.log('🔄 Gerando QR Code inicial...\n');
    
    // Gerar QR Code inicial
    setTimeout(() => {
        generateQRCode();
    }, 1000);
});

// Simular algumas mensagens iniciais
setTimeout(() => {
    simulateIncomingMessage('5511987654321', 'Olá! Como funciona o Zelar?');
    simulateIncomingMessage('5511123456789', 'Bom dia! Preciso de ajuda.');
}, 10000);

process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando simulação...');
    process.exit();
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Encerrando simulação...');
    process.exit();
});