const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

console.log('📱 TESTE COM NÚMERO PESSOAL');
console.log('============================');
console.log('✅ É seguro testar com seu número');
console.log('✅ WhatsApp permite até 4 dispositivos conectados');
console.log('✅ Suas conversas permanecem sincronizadas');

async function startPersonalTest() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_personal_test');
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('ZelarBot-Teste'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 60000,
      getMessage: async (key) => {
        return { conversation: 'Teste pessoal' };
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 QR CODE PARA TESTE PESSOAL GERADO!');
        
        try {
          await QRCode.toFile('qr_teste_pessoal.png', qr, {
            width: 400,
            margin: 3,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          console.log('✅ QR salvo como: qr_teste_pessoal.png');
          console.log('📱 COMO TESTAR:');
          console.log('1. Abra WhatsApp no seu celular');
          console.log('2. Vá em Configurações > Dispositivos conectados');
          console.log('3. Toque em "Conectar um dispositivo"');
          console.log('4. Escaneie o QR code qr_teste_pessoal.png');
          console.log('5. Se conectar, você verá suas conversas aqui!');
          
        } catch (error) {
          console.error('❌ Erro ao salvar QR:', error.message);
        }
      }
      
      if (connection === 'open') {
        console.log('\n🎉 CONECTADO COM SEU NÚMERO PESSOAL!');
        console.log('✅ Bot funcionando perfeitamente');
        console.log('📞 Agora você pode testar enviando mensagens');
        
        // Listar chats disponíveis
        setTimeout(async () => {
          try {
            const chats = Object.keys(sock.store?.chats || {});
            console.log(`\n📋 ${chats.length} conversas encontradas`);
            
            if (chats.length > 0) {
              console.log('💬 Primeiras 3 conversas:');
              chats.slice(0, 3).forEach((chat, i) => {
                console.log(`${i + 1}. ${chat}`);
              });
            }
          } catch (error) {
            console.log('ℹ️  Carregando conversas...');
          }
        }, 3000);
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`\n❌ CONEXÃO ENCERRADA - Código: ${statusCode}`);
        
        if (statusCode !== DisconnectReason.loggedOut) {
          console.log('🔄 Tentando reconectar em 5 segundos...');
          setTimeout(startPersonalTest, 5000);
        }
      }
    });

    // Monitor de mensagens
    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      if (!message.message || message.key.fromMe) return;
      
      const text = message.message.conversation || 
                   message.message.extendedTextMessage?.text || '';
      const from = message.key.remoteJid;
      
      console.log(`\n📩 MENSAGEM RECEBIDA:`);
      console.log(`📱 De: ${from}`);
      console.log(`💬 Texto: "${text}"`);
      
      // Resposta de teste apenas para mensagens com "teste"
      if (text.toLowerCase().includes('teste') || 
          text.toLowerCase().includes('zelar')) {
        try {
          const resposta = '🤖 Bot Zelar funcionando! ' +
                          'Teste realizado com sucesso. ' +
                          'Agora posso processar suas mensagens e criar eventos no calendário!';
          
          await sock.sendMessage(from, { text: resposta });
          console.log('✅ Resposta de teste enviada');
        } catch (error) {
          console.log('❌ Erro ao enviar resposta:', error.message);
        }
      }
    });

    console.log('⏳ Bot iniciado - aguardando QR code...');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.log('🔄 Tentando novamente em 10 segundos...');
    setTimeout(startPersonalTest, 10000);
  }
}

console.log('\n🚀 Iniciando teste com número pessoal...');
startPersonalTest();

process.on('SIGINT', () => {
  console.log('\n🛑 Teste encerrado');
  console.log('📊 QR code salvo em qr_teste_pessoal.png');
  process.exit(0);
});