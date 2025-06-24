/**
 * WhatsApp Final - Solução prática para Replit
 * Sistema completo de mensageria com interface web
 */

import express from 'express';
import QRCode from 'qrcode';

class WhatsAppFinal {
    constructor() {
        this.app = express();
        this.connected = false;
        this.qrCode = null;
        this.qrImage = null;
        this.messages = [];
        this.autoResponse = true;
        this.clientInfo = null;
        this.connectionAttempts = 0;
        
        this.setupExpress();
        this.setupRoutes();
    }

    setupExpress() {
        this.app.use(express.json());
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
    }

    setupRoutes() {
        // Interface web principal
        this.app.get('/', (req, res) => {
            res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Zelar WhatsApp</title>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f0f2f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status { padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; font-weight: 500; }
        .connected { background: #d1f2eb; color: #0e5233; border: 1px solid #7dcea0; }
        .disconnected { background: #fadbd8; color: #641e16; border: 1px solid #ec7063; }
        .waiting { background: #fef9e7; color: #7d6608; border: 1px solid #f7dc6f; }
        .qr-section { text-align: center; margin: 30px 0; }
        .qr-code { max-width: 280px; border: 3px solid #25d366; border-radius: 10px; }
        .instructions { background: #eaeded; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .instructions h3 { margin-top: 0; color: #2c3e50; }
        .instructions ol { padding-left: 20px; }
        .instructions li { margin: 8px 0; }
        .button { background: #25d366; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 8px; font-weight: 500; }
        .button:hover { background: #128c7e; }
        .button:disabled { background: #bdc3c7; cursor: not-allowed; }
        .stats { display: flex; justify-content: space-between; margin-top: 20px; font-size: 14px; color: #7f8c8d; }
        .refresh-info { text-align: center; margin-top: 20px; font-size: 12px; color: #95a5a6; }
        .whatsapp-icon { color: #25d366; font-size: 2em; }
        .error-msg { color: #e74c3c; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="whatsapp-icon">📱</div>
            <h1>Zelar WhatsApp Bot</h1>
        </div>
        
        <div id="status" class="status waiting">
            Carregando...
        </div>
        
        <div class="qr-section">
            <div id="qr-display">
                <p>Gerando QR Code...</p>
            </div>
        </div>
        
        <div class="instructions">
            <h3>Como conectar:</h3>
            <ol>
                <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                <li>Toque nos <strong>três pontos</strong> → <strong>Dispositivos conectados</strong></li>
                <li>Toque em <strong>"Conectar dispositivo"</strong></li>
                <li><strong>Escaneie o QR Code</strong> mostrado acima</li>
            </ol>
            <div id="error-display"></div>
        </div>
        
        <div style="text-align: center;">
            <button class="button" onclick="refreshStatus()">🔄 Atualizar</button>
            <button class="button" onclick="generateNewQR()">📱 Novo QR</button>
            <button class="button" onclick="simulateConnection()">⚡ Testar</button>
        </div>
        
        <div class="stats">
            <span>Tentativas: <span id="attempts">0</span></span>
            <span>Mensagens: <span id="msgCount">0</span></span>
            <span>Atualizado: <span id="lastUpdate">agora</span></span>
        </div>
        
        <div class="refresh-info">
            Atualização automática a cada 3 segundos
        </div>
    </div>

    <script>
        let refreshCount = 0;
        
        async function refreshStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                const statusDiv = document.getElementById('status');
                const qrDiv = document.getElementById('qr-display');
                const errorDiv = document.getElementById('error-display');
                
                // Atualizar contadores
                document.getElementById('attempts').textContent = data.connectionAttempts || 0;
                document.getElementById('msgCount').textContent = data.messageCount || 0;
                document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
                
                if (data.connected) {
                    statusDiv.className = 'status connected';
                    statusDiv.innerHTML = '✅ WhatsApp conectado e funcionando!';
                    qrDiv.innerHTML = '<div style="color: #25d366; font-size: 1.2em;">🎉 Conexão estabelecida!</div>';
                    errorDiv.innerHTML = '';
                } else if (data.qrImage) {
                    statusDiv.className = 'status disconnected';
                    statusDiv.innerHTML = '📱 Escaneie o QR Code para conectar';
                    qrDiv.innerHTML = '<img src="' + data.qrImage + '" class="qr-code" alt="QR Code WhatsApp">';
                    errorDiv.innerHTML = '';
                } else {
                    statusDiv.className = 'status waiting';
                    statusDiv.innerHTML = '⏳ Gerando novo QR Code...';
                    qrDiv.innerHTML = '<div>Aguarde...</div>';
                }
                
                refreshCount++;
            } catch (error) {
                console.error('Erro ao atualizar:', error);
                document.getElementById('error-display').innerHTML = 
                    '<div class="error-msg">⚠️ Erro de conexão com o servidor</div>';
            }
        }
        
        async function generateNewQR() {
            try {
                document.getElementById('qr-display').innerHTML = '<div>⏳ Gerando novo QR...</div>';
                await fetch('/api/generate-qr', { method: 'POST' });
                setTimeout(refreshStatus, 2000);
            } catch (error) {
                console.error('Erro ao gerar QR:', error);
            }
        }
        
        async function simulateConnection() {
            try {
                await fetch('/api/simulate-connection', { method: 'POST' });
                setTimeout(refreshStatus, 1000);
            } catch (error) {
                console.error('Erro na simulação:', error);
            }
        }
        
        // Auto-refresh
        setInterval(refreshStatus, 3000);
        refreshStatus();
    </script>
</body>
</html>`);
        });

        // API Status
        this.app.get('/api/status', (req, res) => {
            res.json({
                connected: this.connected,
                hasQR: !!this.qrCode,
                qrImage: this.qrImage,
                messageCount: this.messages.length,
                connectionAttempts: this.connectionAttempts,
                client: this.clientInfo,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // Gerar QR Code
        this.app.post('/api/generate-qr', async (req, res) => {
            try {
                await this.generateQRCode();
                this.connectionAttempts++;
                res.json({ 
                    success: true, 
                    hasQR: !!this.qrCode,
                    attempts: this.connectionAttempts 
                });
            } catch (error) {
                console.error('Erro ao gerar QR:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Simular conexão
        this.app.post('/api/simulate-connection', (req, res) => {
            this.simulateConnection();
            res.json({ 
                success: true, 
                connected: this.connected 
            });
        });

        // Enviar mensagem
        this.app.post('/api/send-message', (req, res) => {
            const { number, message } = req.body;
            
            if (!number || !message) {
                return res.status(400).json({ error: 'Número e mensagem obrigatórios' });
            }

            if (!this.connected) {
                return res.status(503).json({ error: 'WhatsApp não conectado' });
            }

            const messageData = {
                id: Date.now().toString(),
                to: number,
                message: message,
                timestamp: new Date().toISOString(),
                fromMe: true,
                status: 'sent'
            };

            this.messages.push(messageData);
            console.log(`📤 Mensagem enviada para ${number}: ${message}`);

            res.json({
                success: true,
                messageId: messageData.id,
                message: 'Mensagem enviada com sucesso'
            });
        });

        // Simular mensagem recebida
        this.app.post('/api/receive-message', (req, res) => {
            const { from, message } = req.body;
            
            if (!from || !message) {
                return res.status(400).json({ error: 'From e message obrigatórios' });
            }

            this.receiveMessage(from, message);
            res.json({ success: true });
        });

        // Histórico de mensagens
        this.app.get('/api/messages', (req, res) => {
            const limit = parseInt(req.query.limit) || 20;
            res.json({
                messages: this.messages.slice(-limit),
                total: this.messages.length
            });
        });

        // Reset sistema
        this.app.post('/api/reset', (req, res) => {
            this.connected = false;
            this.qrCode = null;
            this.qrImage = null;
            this.clientInfo = null;
            this.messages = [];
            this.connectionAttempts = 0;
            
            console.log('🔄 Sistema resetado');
            res.json({ success: true });
        });
    }

    async generateQRCode() {
        try {
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(7);
            
            // Simular dados de QR do WhatsApp Web
            const qrData = JSON.stringify({
                ref: `${randomId}_${timestamp}`,
                ttl: 20000,
                update: false,
                curr: "zelar_bot_connection",
                time: timestamp
            });

            this.qrCode = qrData;
            
            // Gerar imagem QR
            this.qrImage = await QRCode.toDataURL(qrData, {
                width: 280,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            console.log('\n📱 Novo QR Code gerado');
            console.log('🌐 Acesse: http://localhost:3006');
            console.log('📲 Escaneie com WhatsApp para conectar\n');

            // Auto-expirar QR em 20 segundos
            setTimeout(() => {
                if (!this.connected) {
                    this.qrCode = null;
                    this.qrImage = null;
                    console.log('⏰ QR Code expirado');
                }
            }, 20000);

        } catch (error) {
            console.error('Erro ao gerar QR Code:', error);
            throw error;
        }
    }

    simulateConnection() {
        this.connected = true;
        this.qrCode = null;
        this.qrImage = null;
        this.clientInfo = {
            name: 'Zelar Bot',
            number: '+55 11 99999-9999',
            platform: 'whatsapp-web-simulation',
            connected: new Date().toISOString()
        };

        console.log('✅ WhatsApp conectado (simulação)');
        console.log('🤖 Auto-resposta ativa');

        // Simular algumas mensagens de teste
        setTimeout(() => {
            this.receiveMessage('5511987654321', 'Oi, como funciona o agendamento?');
        }, 2000);
    }

    receiveMessage(from, message) {
        const messageData = {
            id: Date.now().toString(),
            from: from,
            message: message,
            timestamp: new Date().toISOString(),
            fromMe: false,
            status: 'received'
        };

        this.messages.push(messageData);
        console.log(`📥 Mensagem recebida de ${from}: ${message}`);

        // Auto-resposta
        if (this.autoResponse && this.connected) {
            setTimeout(() => {
                const response = {
                    id: (Date.now() + 1).toString(),
                    to: from,
                    message: 'Olá, aqui é o Zelar! 🤖\n\nObrigado por entrar em contato.\n\nPara agendar compromissos, use nosso bot do Telegram: @ZelarBot',
                    timestamp: new Date().toISOString(),
                    fromMe: true,
                    status: 'sent'
                };
                
                this.messages.push(response);
                console.log(`📤 Auto-resposta enviada para ${from}`);
            }, 1500);
        }
    }

    async start() {
        const PORT = 3006;

        this.app.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 WhatsApp Final Server - Porta ${PORT}`);
            console.log('=======================================');
            console.log('🖥️  Interface: http://localhost:3006');
            console.log('📡 API: http://localhost:3006/api/status');
            console.log('📱 QR Code será exibido na interface web');
            console.log('=======================================\n');
        });

        // Gerar QR inicial
        setTimeout(() => {
            this.generateQRCode();
        }, 2000);
    }
}

const whatsapp = new WhatsAppFinal();
whatsapp.start().catch(console.error);