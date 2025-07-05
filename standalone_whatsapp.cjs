const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');
const { exec } = require('child_process');
const fs = require('fs');

console.log('🚀 Iniciando WhatsApp Bot Zelar...');

let sock = null;
let isConnected = false;

async function startWhatsApp() {
  try {
    console.log('🔄 Configurando conexão WhatsApp...');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_zelar');
    
    sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarBot'),
      printQRInTerminal: false,
      keepAliveIntervalMs: 30000,
      generateHighQualityLinkPreview: true
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 QR CODE GERADO!');
        console.log('🔗 Conecte seu WhatsApp escaneando o código abaixo:\n');
        
        // Salvar QR
        fs.writeFileSync('whatsapp_qr_zelar.txt', qr);
        
        // Gerar imagem
        exec(`qrencode -s 8 -o whatsapp_qr_zelar.png "${qr}"`, (error) => {
          if (!error) {
            console.log('💾 QR salvo como: whatsapp_qr_zelar.png');
          }
        });
        
        // Mostrar QR no terminal
        QRCode.generate(qr, { small: false });
        
        console.log('\n🔸 PARA CONECTAR:');
        console.log('1️⃣ Abra WhatsApp no celular');
        console.log('2️⃣ Configurações → Dispositivos Vinculados'); 
        console.log('3️⃣ Vincular um dispositivo');
        console.log('4️⃣ Escaneie o QR code acima');
        console.log('\n⏳ Aguardando conexão...');
      }
      
      if (connection === 'close') {
        isConnected = false;
        console.log('❌ Conexão perdida');
        
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log('🔄 Reconectando em 5 segundos...');
          setTimeout(() => startWhatsApp(), 5000);
        } else {
          console.log('🛑 Deslogado. Reinicie para nova conexão.');
          process.exit(0);
        }
        
      } else if (connection === 'open') {
        isConnected = true;
        console.log('\n✅ WHATSAPP CONECTADO COM SUCESSO!');
        console.log('🤖 Zelar Bot está ATIVO!');
        console.log('📱 Envie mensagens sobre eventos para testar...\n');
        
        // Configurar handler de mensagens
        sock.ev.on('messages.upsert', handleMessage);
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

async function handleMessage(m) {
  const message = m.messages[0];
  
  if (!message.key.fromMe && message.message) {
    const from = message.key.remoteJid;
    const text = message.message.conversation || 
                 message.message.extendedTextMessage?.text || '';
    
    console.log(`📩 Nova mensagem: "${text}"`);
    
    // Palavras-chave para detectar eventos
    const keywords = [
      'reunião', 'evento', 'compromisso', 'dentista', 'médico', 
      'consulta', 'encontro', 'almoço', 'jantar', 'apresentação',
      'entrevista', 'workshop', 'seminário', 'curso', 'conferência',
      'meeting', 'appointment', 'doctor', 'lunch', 'dinner'
    ];
    
    const isEvent = keywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
    
    if (isEvent) {
      console.log('🎯 Evento detectado! Processando...');
      
      const eventTitle = text.trim();
      const response = `✅ *Evento processado pelo Zelar Bot!*

📅 *"${eventTitle}"*

🔗 *Adicionar ao calendário:*

📱 *Google Calendar:*
https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}

💻 *Outlook:*  
https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventTitle)}

🍎 *Apple Calendar:*
Copie o texto: ${eventTitle}

🤖 *Zelar Bot* - Assistente Inteligente de Calendário
✨ Processamento automático em português`;
      
      try {
        await sock.sendMessage(from, { text: response });
        console.log('✅ Resposta enviada com links de calendário!');
      } catch (error) {
        console.log('❌ Erro ao enviar resposta:', error.message);
      }
    }
  }
}

// Tratamento de sinais
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando bot...');
  if (sock) {
    sock.end();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Encerrando bot...');
  if (sock) {
    sock.end();
  }
  process.exit(0);
});

// Status a cada minuto
setInterval(() => {
  if (isConnected) {
    console.log('💚 Bot ativo - ' + new Date().toLocaleTimeString());
  }
}, 60000);

// Iniciar
startWhatsApp();