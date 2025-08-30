import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

console.log('🧪 Testando WhatsApp Baileys...');

async function testWhatsApp() {
  try {
    console.log('📁 Diretório atual:', process.cwd());
    
    console.log('🔧 Configurando autenticação...');
    const { state, saveCreds } = await useMultiFileAuthState('test_session');
    console.log('✅ Autenticação configurada');
    
    console.log('🔧 Criando socket Baileys...');
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['Test Bot', 'Chrome', '1.0.0'],
      version: [2, 2323, 4],
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 10000,
    });
    console.log('✅ Socket Baileys criado com sucesso!');
    
    // Configurar handlers
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log('🔄 Connection update:', { 
        connection, 
        hasQR: !!qr, 
        qrLength: qr ? qr.length : 0,
        timestamp: new Date().toISOString()
      });
      
      if (qr) {
        console.log('📱 QR Code recebido!');
        console.log('📏 Tamanho do QR:', qr.length);
        console.log('🔗 QR Code (primeiros 50 chars):', qr.substring(0, 50));
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('❌ Conexão fechada:', lastDisconnect?.error, ', reconectando:', shouldReconnect);
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado!');
      }
    });

    sock.ev.on('creds.update', saveCreds);
    
    console.log('✅ Teste configurado com sucesso!');
    
    // Manter o processo vivo por 30 segundos
    setTimeout(() => {
      console.log('⏰ Teste finalizado');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('❌ Stack trace:', error.stack);
    process.exit(1);
  }
}

testWhatsApp();
