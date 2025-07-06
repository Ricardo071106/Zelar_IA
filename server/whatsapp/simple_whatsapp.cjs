const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');

console.log('📱 WhatsApp Bot - Servidor Zelar');

let sock = null;
let isConnected = false;
let qrCodeData = null;

class WhatsAppBot {
  constructor() {
    this.connected = false;
    this.sock = null;
    this.qrCode = null;
  }

  async startWhatsAppBot() {
    try {
      console.log('🔄 Iniciando WhatsApp Bot...');
      
      // Limpar dados antigos
      if (fs.existsSync('qr_data.json')) {
        fs.unlinkSync('qr_data.json');
      }
      
      const { state, saveCreds } = await useMultiFileAuthState('auth_zelar');
      
      this.sock = makeWASocket({
        auth: state,
        browser: Browsers.ubuntu('ZelarBot'),
        printQRInTerminal: false,
        keepAliveIntervalMs: 30000,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
          return { conversation: 'Zelar Bot' };
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          console.log('📱 QR Code gerado para WhatsApp');
          this.qrCode = qr;
          
          // Salvar QR code em arquivo para interface web
          try {
            fs.writeFileSync('qr_data.json', JSON.stringify({ qr: qr }));
            console.log('✅ QR code salvo para interface web');
          } catch (error) {
            console.error('❌ Erro ao salvar QR:', error);
          }
        }
        
        if (connection === 'open') {
          console.log('🎉 WhatsApp conectado com sucesso!');
          this.connected = true;
          isConnected = true;
          
          // Limpar arquivo QR após conexão bem-sucedida
          if (fs.existsSync('qr_data.json')) {
            fs.unlinkSync('qr_data.json');
          }
        }
        
        if (connection === 'close') {
          console.log('❌ WhatsApp desconectado');
          this.connected = false;
          isConnected = false;
          
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          if (statusCode !== DisconnectReason.loggedOut) {
            console.log('🔄 Tentando reconectar...');
            setTimeout(() => this.startWhatsAppBot(), 5000);
          }
        }
      });

      // Monitor de mensagens
      this.sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message || message.key.fromMe) return;
        
        const text = message.message.conversation || 
                     message.message.extendedTextMessage?.text || '';
        const from = message.key.remoteJid;
        
        console.log(`📩 Mensagem recebida de ${from}: "${text}"`);
        
        // Processamento básico de mensagens
        if (text.toLowerCase().includes('oi') || text.toLowerCase().includes('olá')) {
          await this.sendMessage(from, '👋 Olá! Sou o assistente Zelar. Posso ajudar você a criar eventos no seu calendário. Tente me enviar algo como: "Reunião amanhã às 10h"');
        }
      });

      sock = this.sock;
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao iniciar WhatsApp Bot:', error);
      return false;
    }
  }

  async sendMessage(to, message) {
    try {
      if (this.sock && this.connected) {
        await this.sock.sendMessage(to, { text: message });
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  async stopWhatsAppBot() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock = null;
        sock = null;
        this.connected = false;
        isConnected = false;
        console.log('🛑 WhatsApp Bot parado');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Erro ao parar WhatsApp Bot:', error);
      return false;
    }
  }

  getWhatsAppStatus() {
    return {
      connected: this.connected,
      message: this.connected ? 'WhatsApp conectado' : 'WhatsApp desconectado',
      hasQR: !!this.qrCode,
      timestamp: new Date().toISOString()
    };
  }
}

// Exportar instância singleton
const whatsappBot = new WhatsAppBot();

module.exports = whatsappBot;