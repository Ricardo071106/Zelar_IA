const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

console.log('🔍 DIAGNÓSTICO WHATSAPP - Análise Completa');
console.log('📋 Ambiente:', process.platform, process.arch);
console.log('📋 Node.js:', process.version);
console.log('📋 Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

async function diagnosticTest() {
  console.log('\n🧪 TESTE 1: Criando estado de autenticação...');
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState('debug_auth');
    console.log('✅ Estado de autenticação criado com sucesso');
    
    console.log('\n🧪 TESTE 2: Configurando socket...');
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Debug'),
      defaultQueryTimeoutMs: 30000,
      connectTimeoutMs: 20000,
      keepAliveIntervalMs: 30000,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      logger: {
        level: 'debug',
        trace: (...args) => console.log('TRACE:', ...args),
        debug: (...args) => console.log('DEBUG:', ...args),
        info: (...args) => console.log('INFO:', ...args),
        warn: (...args) => console.log('WARN:', ...args),
        error: (...args) => console.log('ERROR:', ...args),
        fatal: (...args) => console.log('FATAL:', ...args)
      },
      getMessage: async (key) => {
        return { conversation: 'test' };
      }
    });

    console.log('✅ Socket criado com sucesso');

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isOnline, isNewLogin } = update;
      
      console.log('\n📊 STATUS UPDATE:');
      console.log('- Connection:', connection);
      console.log('- Online:', isOnline);
      console.log('- New Login:', isNewLogin);
      
      if (lastDisconnect) {
        console.log('- Last Disconnect:', lastDisconnect.error?.message);
        console.log('- Status Code:', lastDisconnect.error?.output?.statusCode);
      }
      
      if (qr) {
        console.log('\n✅ QR CODE GERADO - Testando conectividade...');
        
        // Verificar se conseguimos gerar a imagem
        try {
          await QRCode.toFile('debug_qr.png', qr, {
            width: 400,
            margin: 3
          });
          console.log('✅ QR salvo como debug_qr.png');
          
          // Mostrar estatísticas do QR
          console.log('📊 QR Stats:');
          console.log('- Tamanho:', qr.length, 'caracteres');
          console.log('- Primeiros 50 chars:', qr.substring(0, 50) + '...');
          
        } catch (error) {
          console.log('❌ Erro ao salvar QR:', error.message);
        }
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log('\n❌ CONEXÃO FECHADA');
        console.log('Status Code:', statusCode);
        
        if (statusCode === DisconnectReason.badSession) {
          console.log('🔄 Sessão ruim - limpando e tentando novamente...');
          // Limpar estado e tentar novamente
        } else if (statusCode === DisconnectReason.connectionClosed) {
          console.log('🔄 Conexão fechada - tentando reconectar...');
        } else if (statusCode === DisconnectReason.connectionLost) {
          console.log('🔄 Conexão perdida - tentando reconectar...');
        } else if (statusCode === DisconnectReason.loggedOut) {
          console.log('🚪 Deslogado - não reconectando');
          return;
        } else {
          console.log('🔄 Outro motivo - tentando reconectar...');
        }
        
        setTimeout(() => diagnosticTest(), 5000);
        
      } else if (connection === 'open') {
        console.log('\n🎉 CONECTADO COM SUCESSO!');
        console.log('✅ Diagnóstico completo - WhatsApp funcionando!');
      }
    });

    // Testar eventos de mensagem
    sock.ev.on('messages.upsert', (messageUpdate) => {
      console.log('📩 Mensagem recebida:', messageUpdate.messages.length);
    });

    // Capturar erros detalhados
    sock.ev.on('error', (error) => {
      console.log('\n❌ ERRO DETALHADO:', error);
    });

    console.log('\n⏳ Aguardando eventos...');
    
  } catch (error) {
    console.log('\n❌ ERRO NO DIAGNÓSTICO:', error);
  }
}

diagnosticTest();

// Timeout de segurança
setTimeout(() => {
  console.log('\n⏰ Timeout de 2 minutos atingido');
  process.exit(0);
}, 120000);