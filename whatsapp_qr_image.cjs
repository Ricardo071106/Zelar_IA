const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');

console.log('🚀 WhatsApp Bot - Gerando QR Code como Imagem...');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_image');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('ZelarBot'),
    defaultQueryTimeoutMs: 60000,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async (key) => {
      return {
        conversation: 'Bot message'
      };
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n📱 Gerando QR Code como imagem...');
      
      try {
        // Gerar QR code como imagem PNG
        await QRCode.toFile('whatsapp_qr.png', qr, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        console.log('✅ QR Code salvo como: whatsapp_qr.png');
        console.log('📸 Baixe a imagem e escaneie no WhatsApp!');
        console.log('⏳ Aguardando conexão...\n');
        
        // Também salvar como base64 para exibição
        const qrDataURL = await QRCode.toDataURL(qr, {
          width: 300,
          margin: 2
        });
        
        fs.writeFileSync('whatsapp_qr.txt', qrDataURL);
        console.log('💾 QR Code também salvo como base64 em: whatsapp_qr.txt\n');
        
      } catch (error) {
        console.error('❌ Erro ao gerar QR code:', error);
      }
    }
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Conexão fechada:', lastDisconnect?.error);
      
      if (shouldReconnect) {
        console.log('🔄 Tentando reconectar...');
        setTimeout(startBot, 3000);
      }
    } else if (connection === 'open') {
      console.log('✅ CONECTADO COM SUCESSO!');
      console.log('🤖 Bot WhatsApp ativo e funcionando!');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const message = m.messages[0];
    if (!message.message || message.key.fromMe) return;
    
    const text = message.message.conversation || 
                 message.message.extendedTextMessage?.text || '';
    
    console.log(`📩 Mensagem recebida: "${text}"`);
    
    // Resposta de teste
    if (text.toLowerCase().includes('oi') || text.toLowerCase().includes('olá')) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '👋 Olá! Bot WhatsApp Zelar funcionando perfeitamente!'
      });
    }
  });
}

startBot().catch(err => {
  console.error('❌ Erro ao iniciar bot:', err);
  process.exit(1);
});

// Tratamento de sinais
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando bot...');
  process.exit(0);
});