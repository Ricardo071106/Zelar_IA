const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

let currentQRCode = null;
let sock = null;
let isConnected = false;

// Pasta para salvar QR codes
const qrDir = path.join(__dirname, 'public', 'qr');
if (!fs.existsSync(qrDir)) {
  fs.mkdirSync(qrDir, { recursive: true });
}

// Servir arquivos estáticos
app.use('/qr', express.static(qrDir));

// Endpoint para gerar QR code
app.get('/generate-qr', async (req, res) => {
  try {
    if (sock) {
      return res.json({ error: 'Bot já está rodando' });
    }

    console.log('🚀 Iniciando WhatsApp Web...');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_web');
    
    sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarBot'),
      printQRInTerminal: false
    });
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 QR Code gerado!');
        
        // Gerar QR code como imagem
        const qrPath = path.join(qrDir, 'whatsapp-qr.png');
        await qrcode.toFile(qrPath, qr, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        currentQRCode = `/qr/whatsapp-qr.png?t=${Date.now()}`;
        console.log('✅ QR Code salvo em:', currentQRCode);
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('❌ Conexão fechada, reconectar:', shouldReconnect);
        
        if (shouldReconnect) {
          setTimeout(() => {
            sock = null;
            app.get('/generate-qr', arguments.callee);
          }, 3000);
        } else {
          isConnected = false;
          sock = null;
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado!');
        isConnected = true;
        currentQRCode = null;
        
        // Deletar QR code quando conectado
        const qrPath = path.join(qrDir, 'whatsapp-qr.png');
        if (fs.existsSync(qrPath)) {
          fs.unlinkSync(qrPath);
        }
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // Aguardar QR code por 10 segundos
    let attempts = 0;
    const waitForQR = setInterval(() => {
      if (currentQRCode || attempts > 20) {
        clearInterval(waitForQR);
        
        if (currentQRCode) {
          res.json({ 
            success: true, 
            qrCode: `http://localhost:${PORT}${currentQRCode}`,
            message: 'QR Code gerado com sucesso!'
          });
        } else {
          res.json({ 
            error: 'Timeout ao gerar QR Code'
          });
        }
      }
      attempts++;
    }, 500);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    res.json({ error: error.message });
  }
});

// Status do bot
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    hasQRCode: currentQRCode !== null,
    qrCode: currentQRCode ? `http://localhost:${PORT}${currentQRCode}` : null
  });
});

// Parar bot
app.post('/stop', (req, res) => {
  if (sock) {
    sock.logout();
    sock = null;
    isConnected = false;
    currentQRCode = null;
  }
  res.json({ success: true, message: 'Bot parado' });
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor QR WhatsApp rodando em http://localhost:${PORT}`);
  console.log(`📱 Acesse http://localhost:${PORT}/generate-qr para gerar o QR code`);
});