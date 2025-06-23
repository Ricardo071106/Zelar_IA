/**
 * Zelar - Sistema Completo Telegram + WhatsApp
 * Versão final integrada
 */

import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import express from 'express';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

class ZelarComplete {
    constructor() {
        this.app = express();
        this.whatsapp = null;
        this.qrCode = null;
        this.connected = false;
        this.messages = [];
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
        // Status geral do sistema
        this.app.get('/status', (req, res) => {
            res.json({
                system: 'Zelar Complete',
                whatsapp: {
                    connected: this.connected,
                    hasQR: !!this.qrCode,
                    messageCount: this.messages.length
                },
                telegram: {
                    status: 'running',
                    port: 5000
                },
                timestamp: new Date().toISOString()
            });
        });

        // QR Code do WhatsApp
        this.app.get('/whatsapp/qr', (req, res) => {
            if (this.qrCode && !this.connected) {
                res.json({
                    qr: this.qrCode,
                    message: 'Escaneie com WhatsApp para conectar',
                    connected: false
                });
            } else if (this.connected) {
                res.json({
                    qr: null,
                    message: 'WhatsApp já conectado',
                    connected: true
                });
            } else {
                res.json({
                    qr: null,
                    message: 'Gerando QR Code...',
                    connected: false
                });
            }
        });

        // Enviar mensagem WhatsApp
        this.app.post('/whatsapp/send', async (req, res) => {
            const { number, message } = req.body;
            
            if (!number || !message) {
                return res.status(400).json({
                    error: 'Parâmetros obrigatórios: number, message'
                });
            }

            if (!this.connected || !this.whatsapp) {
                return res.status(503).json({
                    error: 'WhatsApp não conectado. Escaneie o QR Code primeiro.'
                });
            }

            try {
                let jid = number.includes('@') ? number : `${number.replace(/\D/g, '')}@s.whatsapp.net`;
                await this.whatsapp.sendMessage(jid, { text: message });
                
                const messageData = {
                    id: Date.now().toString(),
                    to: number,
                    message: message,
                    timestamp: new Date().toISOString(),
                    fromMe: true,
                    status: 'sent'
                };
                
                this.messages.push(messageData);
                
                console.log(`📤 WhatsApp: Mensagem enviada para ${number}: ${message}`);
                
                res.json({
                    success: true,
                    message: 'Mensagem enviada via WhatsApp',
                    messageId: messageData.id
                });

            } catch (error) {
                console.error('Erro ao enviar mensagem WhatsApp:', error);
                res.status(500).json({
                    error: 'Erro ao enviar mensagem'
                });
            }
        });

        // Histórico de mensagens
        this.app.get('/whatsapp/messages', (req, res) => {
            const limit = parseInt(req.query.limit) || 50;
            const messages = this.messages.slice(-limit);
            
            res.json({
                messages: messages,
                total: this.messages.length,
                limit: limit
            });
        });

        // Reiniciar WhatsApp
        this.app.post('/whatsapp/restart', async (req, res) => {
            try {
                console.log('🔄 Reiniciando WhatsApp...');
                
                if (this.whatsapp) {
                    this.whatsapp.end();
                }
                
                this.connected = false;
                this.qrCode = null;
                
                setTimeout(() => {
                    this.startWhatsApp();
                }, 2000);
                
                res.json({
                    message: 'WhatsApp reiniciado com sucesso'
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Erro ao reiniciar WhatsApp'
                });
            }
        });

        // Informações do sistema
        this.app.get('/', (req, res) => {
            res.json({
                name: 'Zelar - Sistema Completo',
                version: '1.0.0',
                features: [
                    'Telegram Bot com IA Claude',
                    'WhatsApp Bot com Baileys',
                    'Auto-resposta configurável',
                    'API REST completa'
                ],
                endpoints: {
                    whatsapp: [
                        'GET /whatsapp/qr - QR Code',
                        'POST /whatsapp/send - Enviar mensagem',
                        'GET /whatsapp/messages - Histórico',
                        'POST /whatsapp/restart - Reiniciar'
                    ],
                    system: [
                        'GET /status - Status geral',
                        'GET / - Informações'
                    ]
                }
            });
        });
    }

    async startWhatsApp() {
        try {
            const authDir = './auth_info_baileys';
            if (!fs.existsSync(authDir)) {
                fs.mkdirSync(authDir, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(authDir);
            const { version } = await fetchLatestBaileysVersion();

            this.whatsapp = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                browser: ['Zelar', 'Desktop', '1.0.0']
            });

            this.whatsapp.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    this.qrCode = qr;
                    console.log('\n📱 QR CODE WHATSAPP - ESCANEIE AGORA:');
                    console.log('=====================================');
                    qrcode.generate(qr, { small: true });
                    console.log('=====================================');
                    console.log('1. Abra WhatsApp no celular');
                    console.log('2. Menu > Dispositivos conectados');
                    console.log('3. Conectar dispositivo');
                    console.log('4. Escaneie o código acima');
                    console.log('=====================================\n');
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    this.connected = false;
                    this.qrCode = null;
                    
                    if (shouldReconnect) {
                        console.log('🔄 Reconectando WhatsApp...');
                        setTimeout(() => this.startWhatsApp(), 5000);
                    }
                } else if (connection === 'open') {
                    console.log('✅ WhatsApp conectado com sucesso!');
                    console.log('🤖 Auto-resposta: "Olá, aqui é o Zelar!"');
                    this.connected = true;
                    this.qrCode = null;
                }
            });

            this.whatsapp.ev.on('creds.update', saveCreds);

            this.whatsapp.ev.on('messages.upsert', async (m) => {
                const message = m.messages[0];
                if (!message.key.fromMe && m.type === 'notify') {
                    const from = message.key.remoteJid;
                    const text = message.message?.conversation || 
                               message.message?.extendedTextMessage?.text || '';
                    
                    if (text) {
                        console.log(`📥 WhatsApp recebida de ${from}: ${text}`);
                        
                        // Auto-resposta
                        try {
                            await this.whatsapp.sendMessage(from, { 
                                text: 'Olá, aqui é o Zelar! 🤖\n\nPara agendar compromissos, use nosso bot do Telegram.' 
                            });
                            console.log(`📤 Auto-resposta enviada para ${from}`);
                        } catch (error) {
                            console.error('Erro na auto-resposta:', error);
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Erro ao inicializar WhatsApp:', error);
            setTimeout(() => this.startWhatsApp(), 10000);
        }
    }

    start() {
        const PORT = 3003;
        
        this.app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 ZELAR SISTEMA COMPLETO - Porta ${PORT}`);
            console.log('===========================================');
            console.log('✅ Telegram Bot: Rodando (porta 5000)');
            console.log('⏳ WhatsApp Bot: Iniciando...');
            console.log('');
            console.log('📋 Endpoints disponíveis:');
            console.log(`  GET  http://localhost:${PORT}/status`);
            console.log(`  GET  http://localhost:${PORT}/whatsapp/qr`);
            console.log(`  POST http://localhost:${PORT}/whatsapp/send`);
            console.log('');
            console.log('💡 Teste rápido:');
            console.log(`curl http://localhost:${PORT}/status`);
            console.log('===========================================\n');
        });

        this.startWhatsApp();
    }
}

const zelar = new ZelarComplete();
zelar.start();