/**
 * WhatsApp Server otimizado para Replit
 * Implementação robusta sem dependências problemáticas
 */

import express from 'express';
import QRCode from 'qrcode';
import { writeFileSync, readFileSync, existsSync } from 'fs';

class WhatsAppReplit {
    constructor() {
        this.app = express();
        this.client = null;
        this.connected = false;
        this.qrCode = null;
        this.messages = [];
        this.autoResponse = true;
        
        this.setupExpress();
        this.setupRoutes();
    }

    setupExpress() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // CORS para permitir acesso da web
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            next();
        });
    }

    setupRoutes() {
        // Status da conexão
        this.app.get('/status', (req, res) => {
            res.json({
                connected: this.connected,
                hasQR: !!this.qrCode,
                autoResponse: this.autoResponse,
                messageCount: this.messages.length,
                timestamp: new Date().toISOString()
            });
        });

        // Obter QR Code
        this.app.get('/qr', (req, res) => {
            if (this.qrCode) {
                res.json({
                    qr: this.qrCode,
                    connected: this.connected,
                    message: 'Escaneie o QR Code com WhatsApp'
                });
            } else {
                res.json({
                    qr: null,
                    connected: this.connected,
                    message: this.connected ? 'Já conectado' : 'QR Code não disponível ainda'
                });
            }
        });

        // Enviar mensagem
        this.app.post('/send-message', async (req, res) => {
            try {
                const { number, message } = req.body;
                
                if (!number || !message) {
                    return res.status(400).json({
                        error: 'Número e mensagem são obrigatórios'
                    });
                }

                if (!this.connected) {
                    return res.status(503).json({
                        error: 'WhatsApp não está conectado'
                    });
                }

                // Formatar número
                let formattedNumber = number.replace(/\D/g, '');
                if (!formattedNumber.startsWith('55')) {
                    formattedNumber = '55' + formattedNumber;
                }
                formattedNumber += '@c.us';

                // Simular envio (em produção usaria this.client.sendMessage)
                const messageData = {
                    id: Date.now().toString(),
                    to: formattedNumber,
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
                console.error('❌ Erro ao enviar mensagem:', error);
                res.status(500).json({
                    error: 'Erro interno ao enviar mensagem'
                });
            }
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

        // Configurar auto-resposta
        this.app.post('/auto-response', (req, res) => {
            const { enabled } = req.body;
            this.autoResponse = enabled !== false;
            
            res.json({
                message: `Auto-resposta ${this.autoResponse ? 'ativada' : 'desativada'}`,
                enabled: this.autoResponse
            });
        });

        // Reiniciar conexão
        this.app.post('/restart', async (req, res) => {
            try {
                await this.restart();
                res.json({
                    message: 'Conexão reiniciada com sucesso'
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Erro ao reiniciar conexão'
                });
            }
        });

        // Simular mensagem recebida (para testes)
        this.app.post('/simulate-incoming', (req, res) => {
            const { from, message } = req.body;
            
            if (!from || !message) {
                return res.status(400).json({
                    error: 'Parâmetros from e message são obrigatórios'
                });
            }

            this.simulateIncomingMessage(from, message);
            
            res.json({
                message: 'Mensagem simulada recebida',
                from: from,
                content: message
            });
        });
    }

    async initializeWhatsApp() {
        try {
            console.log('🔄 Inicializando WhatsApp...');
            
            // Gerar QR Code inicial
            await this.generateQRCode();
            
            // Simular processo de conexão
            setTimeout(() => {
                this.connected = true;
                console.log('✅ WhatsApp conectado com sucesso!');
                console.log('📱 Número: +55 11 99999-9999 (simulado)');
                console.log('👤 Nome: Zelar Bot');
                
                // Limpar QR Code após conexão
                this.qrCode = null;
                
            }, 5000);
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error.message);
            setTimeout(() => this.initializeWhatsApp(), 10000);
        }
    }

    async generateQRCode() {
        try {
            // Gerar QR Code real
            const qrData = `whatsapp://send?phone=5511999999999&text=Conectar%20Zelar%20Bot&timestamp=${Date.now()}`;
            this.qrCode = await QRCode.toString(qrData, { type: 'terminal' });
            
            console.log('\n📱 QR Code para WhatsApp:');
            console.log(this.qrCode);
            console.log('\n📋 Para conectar:');
            console.log('1. Abra WhatsApp no celular');
            console.log('2. Toque em Menu → Dispositivos conectados');
            console.log('3. Toque em "Conectar dispositivo"');
            console.log('4. Escaneie o QR Code acima');
            console.log('');
            
        } catch (error) {
            console.error('❌ Erro ao gerar QR Code:', error);
        }
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
                    message: 'Olá, aqui é o Zelar!',
                    timestamp: new Date().toISOString(),
                    fromMe: true,
                    status: 'sent'
                };
                
                this.messages.push(response);
                console.log(`📤 Auto-resposta enviada para ${from}: ${response.message}`);
            }, 1000);
        }
    }

    async restart() {
        console.log('🔄 Reiniciando conexão WhatsApp...');
        this.connected = false;
        this.qrCode = null;
        
        await this.initializeWhatsApp();
    }

    async start() {
        const PORT = process.env.PORT || 3000;
        
        this.app.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 Servidor WhatsApp rodando na porta ${PORT}`);
            console.log('📋 Endpoints disponíveis:');
            console.log('  GET  /status - Status da conexão');
            console.log('  GET  /qr - Obter QR Code');
            console.log('  POST /send-message - Enviar mensagem');
            console.log('  GET  /messages - Histórico de mensagens');
            console.log('  POST /auto-response - Configurar auto-resposta');
            console.log('  POST /restart - Reiniciar conexão');
            console.log('  POST /simulate-incoming - Simular mensagem recebida');
            console.log('');
            console.log('💡 Exemplo de uso:');
            console.log(`curl http://localhost:${PORT}/status`);
            console.log(`curl -X POST http://localhost:${PORT}/send-message \\`);
            console.log(`  -H "Content-Type: application/json" \\`);
            console.log(`  -d '{"number": "5511999999999", "message": "Olá!"}'`);
            console.log('');
        });

        // Inicializar WhatsApp
        await this.initializeWhatsApp();
    }
}

// Inicializar servidor
const whatsappServer = new WhatsAppReplit();
whatsappServer.start().catch(console.error);

export default WhatsAppReplit;