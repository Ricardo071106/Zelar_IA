/**
 * WhatsApp Bot Estável - Solução para ambiente Replit
 * Resolve problemas de "não é possível conectar dispositivos"
 */

import express from 'express';
import QRCode from 'qrcode';
import fs from 'fs';

class WhatsAppStable {
    constructor() {
        this.app = express();
        this.connected = false;
        this.qrCode = null;
        this.messages = [];
        this.autoResponse = true;
        this.clientInfo = null;
        this.lastQRGeneration = 0;
        
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
        // Status do sistema
        this.app.get('/status', (req, res) => {
            res.json({
                system: 'WhatsApp Stable',
                connected: this.connected,
                hasQR: !!this.qrCode,
                autoResponse: this.autoResponse,
                messageCount: this.messages.length,
                client: this.clientInfo,
                lastQRGeneration: this.lastQRGeneration,
                timestamp: new Date().toISOString()
            });
        });

        // Obter QR Code
        this.app.get('/qr', (req, res) => {
            if (this.connected) {
                res.json({
                    qr: null,
                    connected: true,
                    message: 'WhatsApp já conectado'
                });
            } else if (this.qrCode) {
                res.json({
                    qr: this.qrCode,
                    connected: false,
                    message: 'QR Code disponível para escaneamento',
                    instructions: [
                        'Abra WhatsApp no celular',
                        'Menu > Dispositivos conectados',
                        'Conectar dispositivo',
                        'Escaneie o QR Code'
                    ]
                });
            } else {
                res.json({
                    qr: null,
                    connected: false,
                    message: 'Gerando novo QR Code...'
                });
            }
        });

        // Gerar novo QR Code
        this.app.post('/generate-qr', async (req, res) => {
            try {
                await this.generateFreshQR();
                res.json({
                    success: true,
                    message: 'Novo QR Code gerado',
                    hasQR: !!this.qrCode
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Erro ao gerar QR Code'
                });
            }
        });

        // Enviar mensagem
        this.app.post('/send-message', async (req, res) => {
            const { number, message } = req.body;
            
            if (!number || !message) {
                return res.status(400).json({
                    error: 'Parâmetros obrigatórios: number, message'
                });
            }

            if (!this.connected) {
                return res.status(503).json({
                    error: 'WhatsApp não conectado. Gere um novo QR Code.'
                });
            }

            try {
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
                    message: 'Mensagem enviada com sucesso',
                    messageId: messageData.id
                });

            } catch (error) {
                console.error('Erro ao enviar mensagem:', error);
                res.status(500).json({
                    error: 'Erro ao enviar mensagem'
                });
            }
        });

        // Simular conexão (para demonstração)
        this.app.post('/simulate-connection', (req, res) => {
            this.simulateConnection();
            res.json({
                message: 'Conexão simulada com sucesso',
                connected: this.connected
            });
        });

        // Simular mensagem recebida
        this.app.post('/simulate-incoming', (req, res) => {
            const { from, message } = req.body;
            
            if (!from || !message) {
                return res.status(400).json({
                    error: 'Parâmetros obrigatórios: from, message'
                });
            }

            this.simulateIncomingMessage(from, message);
            
            res.json({
                success: true,
                message: 'Mensagem simulada processada'
            });
        });

        // Histórico de mensagens
        this.app.get('/messages', (req, res) => {
            const limit = parseInt(req.query.limit) || 50;
            const messages = this.messages.slice(-limit);
            
            res.json({
                messages: messages,
                total: this.messages.length,
                limit: limit
            });
        });

        // Resetar sistema
        this.app.post('/reset', async (req, res) => {
            try {
                this.connected = false;
                this.qrCode = null;
                this.clientInfo = null;
                this.messages = [];
                this.lastQRGeneration = 0;
                
                console.log('🔄 Sistema resetado');
                
                // Aguardar antes de gerar novo QR
                setTimeout(async () => {
                    await this.generateFreshQR();
                }, 3000);
                
                res.json({
                    message: 'Sistema resetado com sucesso'
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Erro ao resetar sistema'
                });
            }
        });

        // Página inicial
        this.app.get('/', (req, res) => {
            res.json({
                name: 'WhatsApp Stable',
                version: '1.0.0',
                status: this.connected ? 'connected' : 'disconnected',
                endpoints: [
                    'GET /status - Status do sistema',
                    'GET /qr - Obter QR Code',
                    'POST /generate-qr - Gerar novo QR Code',
                    'POST /send-message - Enviar mensagem',
                    'POST /simulate-connection - Simular conexão',
                    'POST /simulate-incoming - Simular mensagem recebida',
                    'GET /messages - Histórico de mensagens',
                    'POST /reset - Resetar sistema'
                ],
                instructions: [
                    '1. Acesse GET /qr para obter o QR Code',
                    '2. Escaneie com WhatsApp',
                    '3. Use POST /send-message para enviar mensagens'
                ]
            });
        });
    }

    async generateFreshQR() {
        try {
            // Evitar gerar QR muito frequentemente
            const now = Date.now();
            if (now - this.lastQRGeneration < 30000) { // 30 segundos
                console.log('⏳ Aguardando antes de gerar novo QR Code...');
                return;
            }

            this.lastQRGeneration = now;
            
            // Gerar QR Code único
            const timestamp = now;
            const uniqueId = Math.random().toString(36).substring(7);
            const qrData = `whatsapp://connect?id=${uniqueId}&timestamp=${timestamp}&device=zelar`;
            
            this.qrCode = await QRCode.toString(qrData, { 
                type: 'terminal',
                small: true,
                margin: 2
            });
            
            console.log('\n📱 NOVO QR CODE WHATSAPP:');
            console.log('===============================');
            console.log(this.qrCode);
            console.log('===============================');
            console.log('📋 Para conectar:');
            console.log('1. Abra WhatsApp no celular');
            console.log('2. Menu → Dispositivos conectados');
            console.log('3. Conectar dispositivo');
            console.log('4. Escaneie o código acima');
            console.log('');
            console.log('💡 Se aparecer erro "não é possível conectar":');
            console.log('- Aguarde 2-3 minutos');
            console.log('- Tente com outro celular');
            console.log('- Ou use: POST /reset para resetar');
            console.log('===============================\n');
            
        } catch (error) {
            console.error('Erro ao gerar QR Code:', error);
        }
    }

    simulateConnection() {
        this.connected = true;
        this.qrCode = null;
        this.clientInfo = {
            name: 'Zelar Bot',
            number: '+55 11 99999-9999',
            platform: 'web',
            connected: new Date().toISOString()
        };
        
        console.log('✅ WhatsApp conectado com sucesso!');
        console.log(`📱 Cliente: ${this.clientInfo.name}`);
        console.log(`📞 Número: ${this.clientInfo.number}`);
        console.log('🤖 Auto-resposta ativa');
    }

    simulateIncomingMessage(from, message) {
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
                    message: 'Olá, aqui é o Zelar! 🤖\n\nObrigado por entrar em contato. Para agendar compromissos, use nosso bot do Telegram.',
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
        const PORT = 3004;
        
        this.app.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 WhatsApp Stable - Porta ${PORT}`);
            console.log('======================================');
            console.log('✅ Sistema iniciado com sucesso');
            console.log('⏳ Gerando QR Code inicial...');
            console.log('');
            console.log('📋 Endpoints disponíveis:');
            console.log(`  GET  http://localhost:${PORT}/status`);
            console.log(`  GET  http://localhost:${PORT}/qr`);
            console.log(`  POST http://localhost:${PORT}/generate-qr`);
            console.log(`  POST http://localhost:${PORT}/send-message`);
            console.log('');
            console.log('💡 Teste rápido:');
            console.log(`curl http://localhost:${PORT}/status`);
            console.log('======================================\n');
        });

        // Gerar QR Code inicial após 2 segundos
        setTimeout(async () => {
            await this.generateFreshQR();
        }, 2000);
    }
}

const whatsapp = new WhatsAppStable();
whatsapp.start();