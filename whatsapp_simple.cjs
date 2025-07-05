const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');

console.log('🚀 WhatsApp Bot Simples - Teste de Conectividade...');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_simple');
  
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

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n📱 QR CODE PARA WHATSAPP:');
      QRCode.generate(qr, { small: true });
      console.log('\n🔸 Escaneie o código acima no WhatsApp');
      console.log('⏳ Aguardando conexão...\n');
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
      console.log('🤖 Bot WhatsApp ativo!');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const message = m.messages[0];
    if (!message.message || message.key.fromMe) return;
    
    const text = message.message.conversation || 
                 message.message.extendedTextMessage?.text || '';
    
    console.log(`📩 Mensagem: "${text}"`);
    
    // Resposta simples para teste
    if (text.toLowerCase().includes('oi') || text.toLowerCase().includes('olá')) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '👋 Olá! Bot WhatsApp funcionando!'
      });
    }
  });
}

startBot().catch(err => {
  console.error('❌ Erro ao iniciar:', err);
  process.exit(1);
});

// Tratamento de sinais
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando bot...');
  process.exit(0);
});