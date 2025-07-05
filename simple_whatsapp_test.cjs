const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');
const pino = require('pino');

async function startWhatsApp() {
  try {
    console.log('🚀 Iniciando WhatsApp simples...');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_simple');
    
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('ZelarBot'),
      printQRInTerminal: true
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 ESCANEIE ESTE QR CODE COM SEU WHATSAPP:\n');
        QRCode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        console.log('❌ Conexão fechada');
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado! Envie uma mensagem para testar.');
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      
      if (!message.key.fromMe && message.message) {
        const from = message.key.remoteJid;
        const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
        
        console.log(`📩 Mensagem recebida de ${from}: ${text}`);
        
        if (text.toLowerCase().includes('reunião') || text.toLowerCase().includes('evento')) {
          await sock.sendMessage(from, {
            text: `✅ Entendi! Você quer criar: "${text}".\n\nBot WhatsApp funcionando com Levanter! 🎉`
          });
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

startWhatsApp();