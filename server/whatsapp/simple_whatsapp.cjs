const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');
const { exec } = require('child_process');
const fs = require('fs');

let sock = null;
let isConnected = false;
let currentQR = null;

const WHATSAPP_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting', 
  CONNECTED: 'connected',
  ERROR: 'error'
};

let status = WHATSAPP_STATUS.DISCONNECTED;

async function initializeWhatsApp() {
  try {
    status = WHATSAPP_STATUS.CONNECTING;
    console.log('🚀 Inicializando WhatsApp Bot...');
    
    // Limpar dados antigos
    if (fs.existsSync('auth_info_simple')) {
      fs.rmSync('auth_info_simple', { recursive: true, force: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_simple');
    
    sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarBot'),
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: true,
      syncFullHistory: false
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        currentQR = qr;
        status = WHATSAPP_STATUS.CONNECTING;
        
        console.log('\n📱 QR CODE GERADO PARA WHATSAPP!');
        
        // Salvar QR no arquivo
        fs.writeFileSync('whatsapp_qr_simple.txt', qr);
        
        // Gerar imagem PNG
        exec(`qrencode -s 6 -o whatsapp_qr_simple.png "${qr}"`, (error) => {
          if (!error) {
            console.log('✅ QR salvo: whatsapp_qr_simple.png');
          }
        });
        
        // Mostrar QR no console 
        QRCode.generate(qr, { small: true });
        
        console.log('\n🔸 Para conectar:');
        console.log('1. Escaneie o QR acima');
        console.log('2. Ou baixe whatsapp_qr_simple.png');
        console.log('3. WhatsApp > Configurações > Dispositivos Vinculados');
      }
      
      if (connection === 'close') {
        isConnected = false;
        currentQR = null;
        
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          status = WHATSAPP_STATUS.CONNECTING;
          console.log('🔄 Reconectando WhatsApp...');
          setTimeout(() => initializeWhatsApp(), 3000);
        } else {
          status = WHATSAPP_STATUS.DISCONNECTED;
          console.log('❌ WhatsApp desconectado');
        }
        
      } else if (connection === 'open') {
        isConnected = true;
        currentQR = null;
        status = WHATSAPP_STATUS.CONNECTED;
        
        console.log('\n✅ WHATSAPP CONECTADO COM SUCESSO!');
        console.log('🤖 Bot Zelar ativo! Aguardando mensagens...');
        
        // Handler de mensagens
        sock.ev.on('messages.upsert', handleIncomingMessage);
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    return true;
    
  } catch (error) {
    status = WHATSAPP_STATUS.ERROR;
    console.error('❌ Erro ao inicializar WhatsApp:', error.message);
    return false;
  }
}

async function handleIncomingMessage(m) {
  const message = m.messages[0];
  
  if (!message.key.fromMe && message.message) {
    const from = message.key.remoteJid;
    const text = message.message.conversation || 
                 message.message.extendedTextMessage?.text || '';
    
    console.log(`📩 Mensagem WhatsApp: "${text}"`);
    
    // Detectar eventos
    const eventKeywords = [
      'reunião', 'evento', 'compromisso', 'dentista', 'médico', 
      'consulta', 'encontro', 'almoço', 'jantar', 'apresentação',
      'entrevista', 'workshop', 'seminário', 'curso', 'conferência'
    ];
    
    const hasEvent = eventKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
    
    if (hasEvent) {
      console.log('🎯 Evento detectado! Processando...');
      
      const response = `✅ Evento processado pelo Zelar Bot!

📅 "${text}"

🔗 **Adicionar ao calendário:**

📱 **Google Calendar:**
https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}

💻 **Outlook:**
https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(text)}

🍎 **Apple Calendar:**
Copie e cole no seu calendário: ${text}

🤖 **Zelar Bot** - Assistente Inteligente
Processamento automático de eventos em português`;
      
      try {
        await sock.sendMessage(from, { text: response });
        console.log('✅ Resposta enviada!');
      } catch (error) {
        console.log('❌ Erro ao enviar:', error.message);
      }
    }
  }
}

function getStatus() {
  return {
    connected: isConnected,
    status: status,
    qr: currentQR,
    message: isConnected ? 'WhatsApp conectado' : 
             currentQR ? 'QR code gerado, aguardando scan' : 
             'WhatsApp desconectado'
  };
}

function stopWhatsApp() {
  if (sock) {
    sock.end();
    sock = null;
  }
  isConnected = false;
  currentQR = null;
  status = WHATSAPP_STATUS.DISCONNECTED;
  console.log('🛑 WhatsApp Bot parado');
}

module.exports = {
  startWhatsAppBot: initializeWhatsApp,
  stopWhatsAppBot: stopWhatsApp,
  getWhatsAppStatus: getStatus
};