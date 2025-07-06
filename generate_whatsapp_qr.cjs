const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');

console.log('🚀 Gerando QR Code WhatsApp - Teste Final');
console.log('=====================================');

async function generateQRCode() {
  try {
    console.log('🔄 Configurando conexão WhatsApp...');
    
    // Limpar dados antigos
    const authDir = 'auth_qr_test';
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    const sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarTest'),
      printQRInTerminal: false,
      keepAliveIntervalMs: 30000,
      generateHighQualityLinkPreview: true,
      getMessage: async (key) => {
        return { conversation: 'Zelar Test' };
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 QR CODE GERADO COM SUCESSO!');
        
        try {
          // Gerar QR code como imagem PNG
          await QRCode.toFile('whatsapp_qr_novo.png', qr, {
            width: 512,
            margin: 4,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
          });
          
          console.log('✅ QR code salvo como: whatsapp_qr_novo.png');
          console.log('📱 INSTRUÇÕES:');
          console.log('1. Abra WhatsApp no seu celular');
          console.log('2. Toque no menu (⋮) > Dispositivos conectados');
          console.log('3. Toque em "Conectar um dispositivo"');
          console.log('4. Escaneie o QR code whatsapp_qr_novo.png');
          console.log('5. Aguarde a conexão...');
          
          // Salvar dados do QR para interface web
          fs.writeFileSync('whatsapp_qr_data.json', JSON.stringify({
            qr: qr,
            timestamp: new Date().toISOString(),
            status: 'generated'
          }));
          
        } catch (error) {
          console.error('❌ Erro ao salvar QR:', error.message);
        }
      }
      
      if (connection === 'open') {
        console.log('\n🎉 WHATSAPP CONECTADO COM SUCESSO!');
        console.log('✅ Bot funcionando perfeitamente');
        console.log('📞 Agora você pode enviar mensagens de teste');
        
        // Atualizar status
        fs.writeFileSync('whatsapp_qr_data.json', JSON.stringify({
          qr: null,
          timestamp: new Date().toISOString(),
          status: 'connected'
        }));
        
        setTimeout(() => {
          console.log('🛑 Encerrando teste (conexão confirmada)');
          process.exit(0);
        }, 5000);
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`\n❌ CONEXÃO ENCERRADA - Código: ${statusCode}`);
        
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('ℹ️  QR code foi escaneado mas conexão falhou');
        } else if (statusCode === DisconnectReason.restartRequired) {
          console.log('🔄 Tentando reconectar...');
          setTimeout(generateQRCode, 3000);
        }
      }
    });

    // Monitor de mensagens para teste
    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      if (!message.message || message.key.fromMe) return;
      
      const text = message.message.conversation || 
                   message.message.extendedTextMessage?.text || '';
      const from = message.key.remoteJid;
      
      console.log(`\n📩 MENSAGEM RECEBIDA:`);
      console.log(`📱 De: ${from}`);
      console.log(`💬 Texto: "${text}"`);
      
      // Resposta automática de teste
      if (text.toLowerCase().includes('teste')) {
        try {
          const resposta = '✅ WhatsApp Bot Zelar funcionando!\n' +
                          'Teste realizado com sucesso.\n' +
                          'O sistema está operacional!';
          
          await sock.sendMessage(from, { text: resposta });
          console.log('✅ Resposta de teste enviada');
        } catch (error) {
          console.log('❌ Erro ao enviar resposta:', error.message);
        }
      }
    });

    console.log('⏳ Aguardando geração do QR code...');
    
    // Timeout de 60 segundos para gerar QR
    setTimeout(() => {
      console.log('⏰ Timeout: QR code não foi gerado em 60 segundos');
      console.log('🔄 Isso pode indicar limitação do ambiente');
      process.exit(1);
    }, 60000);
    
  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO:', error.message);
    console.log('🔍 Detalhes:', error);
    process.exit(1);
  }
}

console.log('🚀 Iniciando geração de QR code...');
generateQRCode();

// Capturar interrupção
process.on('SIGINT', () => {
  console.log('\n🛑 Processo interrompido pelo usuário');
  console.log('📊 Verifique se o arquivo whatsapp_qr_novo.png foi criado');
  process.exit(0);
});