const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

let currentQRCode = null;
let isConnected = false;
let sock = null;

async function startWhatsAppQRService() {
  try {
    console.log('🚀 Iniciando serviço QR WhatsApp...');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_qr');
    
    sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarBot'),
      printQRInTerminal: false
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 QR Code gerado!');
        currentQRCode = qr;
        
        // Salvar QR para a API
        const qrData = {
          qr: qr,
          timestamp: Date.now(),
          connected: false
        };
        
        fs.writeFileSync('qr_data.json', JSON.stringify(qrData, null, 2));
      }
      
      if (connection === 'close') {
        console.log('❌ Conexão fechada');
        isConnected = false;
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log('🔄 Tentando reconectar...');
          setTimeout(() => startWhatsAppQRService(), 3000);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado!');
        isConnected = true;
        currentQRCode = null;
        
        // Atualizar status
        const qrData = {
          qr: null,
          timestamp: Date.now(),
          connected: true
        };
        
        fs.writeFileSync('qr_data.json', JSON.stringify(qrData, null, 2));
        
        // Configurar handler de mensagens
        sock.ev.on('messages.upsert', async (m) => {
          const message = m.messages[0];
          
          if (!message.key.fromMe && message.message) {
            const from = message.key.remoteJid;
            const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
            
            console.log(`📩 Mensagem recebida: ${text}`);
            
            // Simular processamento com Claude AI
            if (text.toLowerCase().includes('reunião') || 
                text.toLowerCase().includes('evento') || 
                text.toLowerCase().includes('compromisso')) {
              
              const response = `✅ Evento processado com sucesso!\n\n📅 "${text}"\n\n🔗 Links para calendário:\n• Google Calendar: https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}\n• Outlook: https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(text)}\n\n🤖 Zelar Bot com Claude AI`;
              
              await sock.sendMessage(from, { text: response });
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

// Inicializar arquivo QR
fs.writeFileSync('qr_data.json', JSON.stringify({ qr: null, timestamp: Date.now(), connected: false }, null, 2));

// Iniciar serviço
startWhatsAppQRService();

// Manter processo ativo
process.on('SIGINT', () => {
  console.log('🛑 Encerrando serviço...');
  if (sock) {
    sock.end();
  }
  process.exit(0);
});