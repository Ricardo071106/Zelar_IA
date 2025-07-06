const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

console.log('🚀 WhatsApp Bot - Versão Corrigida');

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_fixed');
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('ZelarBot'),
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      // Removido logger personalizado que estava causando erro
      getMessage: async (key) => {
        return { conversation: 'Bot message' };
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log('\n📊 CONNECTION UPDATE:');
      console.log('Status:', connection);
      
      if (qr) {
        console.log('\n📱 QR CODE GERADO:');
        
        try {
          // Gerar QR como imagem
          await QRCode.toFile('whatsapp_fixed_qr.png', qr, {
            width: 400,
            margin: 3,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          console.log('✅ QR salvo como: whatsapp_fixed_qr.png');
          console.log('📸 Baixe e escaneie no WhatsApp!');
          
          // Verificar tamanho e formato do QR
          console.log('📋 QR Info:');
          console.log('- Tamanho:', qr.length, 'chars');
          console.log('- Começa com:', qr.substring(0, 20));
          
        } catch (error) {
          console.error('❌ Erro ao salvar QR:', error.message);
        }
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message;
        
        console.log('\n❌ CONEXÃO FECHADA');
        console.log('- Código:', statusCode);
        console.log('- Motivo:', reason);
        
        // Análise detalhada do erro
        switch(statusCode) {
          case DisconnectReason.badSession:
            console.log('🔄 Sessão inválida - limpando dados...');
            break;
          case DisconnectReason.connectionClosed:
            console.log('🔄 Conexão fechada pelo servidor');
            break;
          case DisconnectReason.connectionLost:
            console.log('🔄 Conexão perdida');
            break;
          case DisconnectReason.connectionReplaced:
            console.log('🔄 Conexão substituída');
            break;
          case DisconnectReason.loggedOut:
            console.log('🚪 Logout detectado - não reconectando');
            return;
          case DisconnectReason.restartRequired:
            console.log('🔄 Reinício necessário');
            break;
          case DisconnectReason.timedOut:
            console.log('⏰ Timeout na conexão');
            break;
          default:
            console.log('❓ Motivo desconhecido:', statusCode);
        }
        
        // Aguardar antes de reconectar
        console.log('⏳ Aguardando 5 segundos para reconectar...');
        setTimeout(startBot, 5000);
        
      } else if (connection === 'open') {
        console.log('\n🎉 SUCESSO! WhatsApp conectado!');
        console.log('✅ Bot está funcionando perfeitamente!');
      } else if (connection === 'connecting') {
        console.log('🔄 Conectando...');
      }
    });

    // Eventos de mensagem
    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      if (!message.message || message.key.fromMe) return;
      
      const text = message.message.conversation || 
                   message.message.extendedTextMessage?.text || '';
      
      console.log(`📩 Mensagem: "${text}"`);
      
      // Resposta de teste
      if (text.toLowerCase().includes('oi') || text.toLowerCase().includes('olá')) {
        try {
          await sock.sendMessage(message.key.remoteJid, {
            text: '👋 Olá! Bot WhatsApp Zelar funcionando perfeitamente!'
          });
          console.log('✅ Resposta enviada');
        } catch (error) {
          console.log('❌ Erro ao enviar:', error.message);
        }
      }
    });

    console.log('⏳ Bot iniciado - aguardando QR code...');
    
  } catch (error) {
    console.log('\n❌ ERRO FATAL:', error.message);
    console.log('🔄 Tentando novamente em 10 segundos...');
    setTimeout(startBot, 10000);
  }
}

startBot();

// Encerramento limpo
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando bot...');
  process.exit(0);
});