/**
 * WhatsApp Bot usando Baileys - QR Code Real
 */

import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import express from 'express';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

class WhatsAppBaileys {
    constructor() {
        this.app = express();
        this.sock = null;
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
            res.header('Access-Control-Allow-Methods', 'GET, POST');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
    }

    setupRoutes() {
        // Status
        this.app.get('/status', (req, res) => {
            res.json({
                connected: this.connected,
                hasQR: !!this.qrCode,
                messageCount: this.messages.length
            });
        });

        // QR Code
        this.app.get('/qr', (req, res) => {
            res.json({
                qr: this.qrCode,
                connected: this.connected
            });
        });

        // Enviar mensagem
        this.app.post('/send-message', async (req, res) => {
            const { number, message } = req.body;
            
            if (!this.connected || !this.sock) {
                return res.status(503).json({ error: 'WhatsApp não conectado' });
            }

            try {
                let jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
                await this.sock.sendMessage(jid, { text: message });
                
                console.log(`Mensagem enviada para ${number}: ${message}`);
                res.json({ success: true, message: 'Enviado' });
            } catch (error) {
                console.error('Erro ao enviar:', error);
                res.status(500).json({ error: 'Erro ao enviar' });
            }
        });
    }

    async startWhatsApp() {
        try {
            // Criar diretório de auth se não existir
            const authDir = './auth_info_baileys';
            if (!fs.existsSync(authDir)) {
                fs.mkdirSync(authDir, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(authDir);
            const { version, isLatest } = await fetchLatestBaileysVersion();
            
            console.log(`Usando Baileys v${version.join('.')}, isLatest: ${isLatest}`);

            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false, // Vamos controlar o QR manualmente
                browser: ['Zelar Bot', 'Desktop', '1.0.0']
            });

            this.sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    this.qrCode = qr;
                    console.log('\n=== QR CODE WHATSAPP ===');
                    qrcode.generate(qr, { small: true });
                    console.log('\nEscaneie com WhatsApp:');
                    console.log('1. Abra WhatsApp');
                    console.log('2. Menu > Dispositivos conectados');
                    console.log('3. Conectar dispositivo');
                    console.log('4. Escaneie o código acima');
                    console.log('========================\n');
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('Conexão fechada devido a:', lastDisconnect?.error, ', reconectando:', shouldReconnect);
                    
                    this.connected = false;
                    if (shouldReconnect) {
                        this.startWhatsApp();
                    }
                } else if (connection === 'open') {
                    console.log('✅ WhatsApp conectado!');
                    this.connected = true;
                    this.qrCode = null;
                }
            });

            this.sock.ev.on('creds.update', saveCreds);

            // Mensagens recebidas
            this.sock.ev.on('messages.upsert', async (m) => {
                const message = m.messages[0];
                if (!message.key.fromMe && m.type === 'notify') {
                    const from = message.key.remoteJid;
                    const text = message.message?.conversation || 
                               message.message?.extendedTextMessage?.text || '';
                    
                    if (text) {
                        console.log(`📥 Mensagem de ${from}: ${text}`);
                        
                        // Auto-resposta
                        try {
                            await this.sock.sendMessage(from, { text: 'Olá, aqui é o Zelar!' });
                            console.log(`📤 Auto-resposta enviada para ${from}`);
                        } catch (error) {
                            console.error('Erro na auto-resposta:', error);
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Erro ao inicializar WhatsApp:', error);
            setTimeout(() => this.startWhatsApp(), 5000);
        }
    }

    start() {
        const PORT = 3002;
        
        this.app.listen(PORT, () => {
            console.log(`🌐 Servidor WhatsApp Baileys - Porta ${PORT}`);
            console.log('📱 Aguardando QR Code...\n');
        });

        this.startWhatsApp();
    }
}

const bot = new WhatsAppBaileys();
bot.start();