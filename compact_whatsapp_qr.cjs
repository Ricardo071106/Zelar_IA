const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');

async function startWhatsApp() {
  try {
    console.log('🚀 Iniciando WhatsApp Bot...');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_compact');
    
    const sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarBot'),
      printQRInTerminal: false  // Desativar para controlar manualmente
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 QR CODE WHATSAPP (VERSÃO COMPACTA):\n');
        
        // Gerar QR code pequeno e compacto
        QRCode.generate(qr, { 
          small: true,
          width: 60  // Ainda menor
        });
        
        console.log('\n🔸 INSTRUÇÕES:');
        console.log('1. Abra WhatsApp no celular');
        console.log('2. Vá em Configurações > Dispositivos Vinculados');
        console.log('3. Toque em "Vincular um dispositivo"');
        console.log('4. Escaneie o QR code acima\n');
      }
      
      if (connection === 'close') {
        console.log('❌ Conexão fechada');
        process.exit(0);
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado! Pode fechar este terminal.');
        
        // Manter bot ativo para receber mensagens
        sock.ev.on('messages.upsert', async (m) => {
          const message = m.messages[0];
          
          if (!message.key.fromMe && message.message) {
            const from = message.key.remoteJid;
            const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
            
            console.log(`📩 Mensagem: ${text}`);
            
            if (text.toLowerCase().includes('reunião') || text.toLowerCase().includes('evento')) {
              await sock.sendMessage(from, {
                text: `✅ Bot WhatsApp funcionando!\n\nRecebido: "${text}"\n\n🔗 Em breve você receberá os links do calendário com Claude AI integrado!`
              });
            }
          }
        });
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

startWhatsApp();