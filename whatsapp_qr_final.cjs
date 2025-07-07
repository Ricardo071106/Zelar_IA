const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

console.log('🚀 Novo QR Code WhatsApp - Teste Final');
console.log('====================================');

async function criarQRCode() {
  try {
    // Limpar sessões anteriores
    const authFolder = 'auth_whatsapp_novo';
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
    }
    
    console.log('🔄 Configurando nova sessão WhatsApp...');
    
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    const socket = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarAssistente'),
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      keepAliveIntervalMs: 60000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      getMessage: async (key) => {
        return { conversation: 'Zelar Bot Test' };
      }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n✅ QR CODE GERADO!');
        console.log('================');
        
        try {
          const qrImagePath = 'whatsapp_qr_final.png';
          
          // Gerar QR de alta qualidade
          await QRCode.toFile(qrImagePath, qr, {
            width: 600,
            margin: 3,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: 'H'
          });
          
          console.log(`📱 QR Code salvo: ${qrImagePath}`);
          console.log('');
          console.log('📋 INSTRUÇÕES:');
          console.log('1. Abra WhatsApp no seu celular');
          console.log('2. Toque no menu (⋮) > Dispositivos conectados');
          console.log('3. Toque em "Conectar um dispositivo"');
          console.log('4. Escaneie o QR code gerado');
          console.log('5. Aguarde a conexão...');
          console.log('');
          
          // Salvar dados do QR
          const qrData = {
            qr: qr,
            timestamp: new Date().toISOString(),
            status: 'generated',
            file: qrImagePath
          };
          
          fs.writeFileSync('qr_data.json', JSON.stringify(qrData, null, 2));
          
        } catch (error) {
          console.error('❌ Erro ao salvar QR:', error.message);
        }
      }
      
      if (connection === 'open') {
        console.log('\n🎉 CONEXÃO ESTABELECIDA!');
        console.log('✅ WhatsApp conectado com sucesso');
        console.log('🤖 Bot pronto para receber mensagens');
        
        // Atualizar status
        fs.writeFileSync('qr_data.json', JSON.stringify({
          qr: null,
          timestamp: new Date().toISOString(),
          status: 'connected'
        }, null, 2));
        
        // Manter conexão ativa por 30 segundos para teste
        setTimeout(() => {
          console.log('🔄 Encerrando teste (conexão confirmada)');
          process.exit(0);
        }, 30000);
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.output?.payload?.error;
        
        console.log(`\n❌ Conexão fechada: ${statusCode}`);
        console.log(`📄 Motivo: ${reason || 'Desconhecido'}`);
        
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('ℹ️  Sessão expirada ou desconectada');
        } else if (statusCode === DisconnectReason.restartRequired) {
          console.log('🔄 Reiniciando conexão...');
          setTimeout(() => criarQRCode(), 5000);
          return;
        }
        
        console.log('🛑 Processo finalizado');
        process.exit(0);
      }
    });

    // Listener para mensagens de teste
    socket.ev.on('messages.upsert', async (messageUpdate) => {
      const message = messageUpdate.messages[0];
      if (!message.message || message.key.fromMe) return;
      
      const messageText = message.message.conversation || 
                         message.message.extendedTextMessage?.text || '';
      const fromNumber = message.key.remoteJid;
      
      console.log(`\n📩 Nova mensagem:`);
      console.log(`📱 De: ${fromNumber}`);
      console.log(`💬 Texto: "${messageText}"`);
      
      if (messageText.toLowerCase().includes('teste')) {
        try {
          const resposta = '🤖 Zelar Bot ativo!\n\n' +
                          'Teste de conexão realizado com sucesso.\n' +
                          'Sistema WhatsApp funcionando!';
          
          await socket.sendMessage(fromNumber, { text: resposta });
          console.log('✅ Resposta enviada com sucesso');
        } catch (error) {
          console.log('❌ Erro ao responder:', error.message);
        }
      }
    });

    console.log('⏳ Aguardando geração do QR code...');
    
    // Timeout de 90 segundos
    setTimeout(() => {
      console.log('\n⏰ Timeout: QR não gerado em 90 segundos');
      console.log('🔍 Possível limitação do ambiente');
      process.exit(1);
    }, 90000);
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('🔍 Stack:', error.stack);
    process.exit(1);
  }
}

// Capturar CTRL+C
process.on('SIGINT', () => {
  console.log('\n🛑 Interrompido pelo usuário');
  console.log('📂 Verifique se o arquivo QR foi gerado');
  process.exit(0);
});

console.log('🚀 Iniciando geração...');
criarQRCode();