/**
 * WhatsApp Real - Implementação definitiva para Replit
 * Usa a biblioteca whatsapp-web.js com configurações otimizadas
 */

import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import express from 'express';
import qrcode from 'qrcode-terminal';
import qr from 'qrcode';
import fs from 'fs';
import path from 'path';

class WhatsAppReal {
    constructor() {
        this.app = express();
        this.client = null;
        this.connected = false;
        this.qrCode = null;
        this.qrString = null;
        this.messages = [];
        this.autoResponse = true;
        this.clientInfo = null;
        
        this.setupExpress();
        this.setupRoutes();
    }

    setupExpress() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
    }

    setupRoutes() {
        // Página web com QR code
        this.app.get('/', (req, res) => {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Zelar WhatsApp</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .disconnected { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .qr-container { text-align: center; margin: 20px 0; }
        .qr-code { max-width: 300px; height: auto; border: 2px solid #ddd; }
        .instructions { background: #e2e3e5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .button { background: #25d366; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
        .button:hover { background: #128c7e; }
        .refresh { font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Zelar WhatsApp Bot</h1>
        
        <div id="status" class="status disconnected">
            ⏳ Iniciando conexão...
        </div>
        
        <div class="qr-container">
            <div id="qr-display">
                <p>Gerando QR Code...</p>
            </div>
        </div>
        
        <div class="instructions">
            <h3>📱 Como conectar:</h3>
            <ol>
                <li>Abra WhatsApp no seu celular</li>
                <li>Toque em <strong>Menu</strong> → <strong>Dispositivos conectados</strong></li>
                <li>Toque em <strong>Conectar dispositivo</strong></li>
                <li>Escaneie o QR Code acima</li>
            </ol>
        </div>
        
        <div style="text-align: center;">
            <button class="button" onclick="refreshStatus()">🔄 Atualizar</button>
            <button class="button" onclick="generateNewQR()">📱 Novo QR Code</button>
        </div>
        
        <div class="refresh">
            <p><small>Página atualiza automaticamente a cada 5 segundos</small></p>
        </div>
    </div>

    <script>
        async function refreshStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                const statusDiv = document.getElementById('status');
                const qrDiv = document.getElementById('qr-display');
                
                if (data.connected) {
                    statusDiv.className = 'status connected';
                    statusDiv.innerHTML = '✅ WhatsApp conectado! Bot ativo.';
                    qrDiv.innerHTML = '<p style="color: green;">✅ Conectado com sucesso!</p>';
                } else if (data.qrImage) {
                    statusDiv.className = 'status disconnected';
                    statusDiv.innerHTML = '📱 Escaneie o QR Code para conectar';
                    qrDiv.innerHTML = '<img src="' + data.qrImage + '" class="qr-code" alt="QR Code">';
                } else {
                    statusDiv.innerHTML = '⏳ Gerando QR Code...';
                    qrDiv.innerHTML = '<p>Aguarde...</p>';
                }
            } catch (error) {
                console.error('Erro:', error);
            }
        }
        
        async function generateNewQR() {
            try {
                await fetch('/api/generate-qr', { method: 'POST' });
                setTimeout(refreshStatus, 2000);
            } catch (error) {
                console.error('Erro:', error);
            }
        }
        
        // Atualizar automaticamente
        setInterval(refreshStatus, 5000);
        refreshStatus();
    </script>
</body>
</html>`;
            res.send(html);
        });

        // API Status
        this.app.get('/api/status', (req, res) => {
            res.json({
                connected: this.connected,
                hasQR: !!this.qrString,
                qrImage: this.qrString ? `data:image/png;base64,${this.qrString}` : null,
                messageCount: this.messages.length,
                client: this.clientInfo,
                timestamp: new Date().toISOString()
            });
        });

        // Gerar novo QR
        this.app.post('/api/generate-qr', async (req, res) => {
            try {
                if (this.client) {
                    await this.client.destroy();
                }
                await this.initializeClient();
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Enviar mensagem
        this.app.post('/api/send-message', async (req, res) => {
            const { number, message } = req.body;
            
            if (!this.connected || !this.client) {
                return res.status(503).json({ error: 'WhatsApp não conectado' });
            }

            try {
                const chatId = number.includes('@') ? number : `${number}@c.us`;
                await this.client.sendMessage(chatId, message);
                
                const messageData = {
                    id: Date.now().toString(),
                    to: number,
                    message: message,
                    timestamp: new Date().toISOString(),
                    fromMe: true
                };
                
                this.messages.push(messageData);
                res.json({ success: true, messageId: messageData.id });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Histórico
        this.app.get('/api/messages', (req, res) => {
            res.json({
                messages: this.messages.slice(-50),
                total: this.messages.length
            });
        });
    }

    async initializeClient() {
        try {
            console.log('🔄 Inicializando WhatsApp Client...');
            
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: './whatsapp-session'
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
                        '--disable-gpu'
                    ]
                }
            });

            this.client.on('qr', async (qrData) => {
                console.log('\n📱 QR CODE GERADO:');
                qrcode.generate(qrData, { small: true });
                
                // Gerar imagem base64 para a web
                this.qrString = await qr.toDataURL(qrData);
                this.qrCode = qrData;
                
                console.log('\n✅ QR Code disponível na web: http://localhost:3005');
                console.log('📱 Escaneie com WhatsApp para conectar\n');
            });

            this.client.on('ready', () => {
                console.log('✅ WhatsApp conectado com sucesso!');
                this.connected = true;
                this.qrCode = null;
                this.qrString = null;
                this.clientInfo = {
                    name: 'Zelar Bot',
                    number: this.client.info?.wid?.user || 'N/A',
                    platform: 'whatsapp-web.js'
                };
            });

            this.client.on('message', async (message) => {
                if (!message.fromMe) {
                    console.log(`📥 Mensagem de ${message.from}: ${message.body}`);
                    
                    this.messages.push({
                        id: message.id._serialized,
                        from: message.from,
                        message: message.body,
                        timestamp: new Date(message.timestamp * 1000).toISOString(),
                        fromMe: false
                    });

                    // Auto-resposta
                    if (this.autoResponse) {
                        setTimeout(async () => {
                            try {
                                await message.reply('Olá, aqui é o Zelar! 🤖\n\nObrigado por entrar em contato. Para agendar compromissos, use nosso bot do Telegram.');
                                console.log(`📤 Auto-resposta enviada para ${message.from}`);
                            } catch (error) {
                                console.error('Erro na auto-resposta:', error);
                            }
                        }, 1000);
                    }
                }
            });

            this.client.on('disconnected', (reason) => {
                console.log('❌ WhatsApp desconectado:', reason);
                this.connected = false;
                this.qrCode = null;
                this.qrString = null;
                this.clientInfo = null;
            });

            await this.client.initialize();
            
        } catch (error) {
            console.error('❌ Erro ao inicializar cliente:', error);
            setTimeout(() => this.initializeClient(), 10000);
        }
    }

    async start() {
        const PORT = 3005;
        
        // Criar diretório public se não existir
        if (!fs.existsSync('./public')) {
            fs.mkdirSync('./public');
        }

        this.app.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 WhatsApp Real Server - Porta ${PORT}`);
            console.log('=====================================');
            console.log('🖥️  Interface Web: http://localhost:3005');
            console.log('📡 API Status: http://localhost:3005/api/status');
            console.log('📱 QR Code será exibido no console e na web');
            console.log('=====================================\n');
        });

        // Inicializar cliente WhatsApp
        await this.initializeClient();
    }
}

const whatsapp = new WhatsAppReal();
whatsapp.start().catch(console.error);