const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');
const { exec } = require('child_process');
const fs = require('fs');

let currentQRData = null;

async function startWhatsAppAndSaveQR() {
  try {
    console.log('🚀 Iniciando WhatsApp Bot para gerar QR...');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_image');
    
    const sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarBot'),
      printQRInTerminal: false
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 QR CODE GERADO!');
        currentQRData = qr;
        
        // Salvar QR como arquivo texto
        fs.writeFileSync('whatsapp_qr.txt', qr);
        
        // Gerar QR como imagem PNG usando qrencode
        exec(`qrencode -s 10 -o whatsapp_qr.png "${qr}"`, (error, stdout, stderr) => {
          if (error) {
            console.log('⚠️  Erro ao gerar imagem PNG, mostrando no terminal:');
            
            // Mostrar QR no terminal
            QRCode.generate(qr, { small: true });
            
            console.log('\n🔸 INSTRUÇÕES:');
            console.log('1. Abra WhatsApp no celular');
            console.log('2. Vá em Configurações > Dispositivos Vinculados');
            console.log('3. Toque em "Vincular um dispositivo"');
            console.log('4. Escaneie o QR code acima');
            
          } else {
            console.log('✅ QR Code salvo como imagem PNG: whatsapp_qr.png');
            console.log('📁 Você pode baixar o arquivo whatsapp_qr.png');
            
            // Também mostrar no terminal
            QRCode.generate(qr, { small: true });
            
            console.log('\n🔸 OPÇÕES PARA ESCANEAR:');
            console.log('1. Baixe o arquivo whatsapp_qr.png');
            console.log('2. Ou escaneie diretamente o QR acima');
            console.log('\n📱 Como conectar:');
            console.log('• Abra WhatsApp no celular');
            console.log('• Vá em Configurações > Dispositivos Vinculados');
            console.log('• Toque em "Vincular um dispositivo"');
            console.log('• Escaneie o QR code');
          }
        });
      }
      
      if (connection === 'close') {
        console.log('❌ Conexão fechada');
        
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('🔄 Tentando reconectar...');
          setTimeout(() => startWhatsAppAndSaveQR(), 3000);
        } else {
          process.exit(0);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado com sucesso!');
        console.log('🤖 Bot ativo! Envie mensagens sobre eventos e receba links de calendário.');
        
        // Handler de mensagens
        sock.ev.on('messages.upsert', async (m) => {
          const message = m.messages[0];
          
          if (!message.key.fromMe && message.message) {
            const from = message.key.remoteJid;
            const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
            
            console.log('📩 Mensagem recebida: ' + text);
            
            // Detectar eventos
            if (text.toLowerCase().includes('reunião') || 
                text.toLowerCase().includes('evento') || 
                text.toLowerCase().includes('compromisso') ||
                text.toLowerCase().includes('dentista') ||
                text.toLowerCase().includes('médico') ||
                text.toLowerCase().includes('consulta') ||
                text.toLowerCase().includes('encontro') ||
                text.toLowerCase().includes('almoço') ||
                text.toLowerCase().includes('jantar')) {
              
              const response = `✅ Evento detectado e processado!

📅 "${text}"

🔗 Links para adicionar ao calendário:

📱 Google Calendar:
https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}

💻 Outlook:
https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(text)}

🍎 Apple Calendar:
data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${text}
END:VEVENT
END:VCALENDAR

🤖 Zelar Bot - Assistente Inteligente`;
              
              await sock.sendMessage(from, { text: response });
              console.log('✅ Resposta enviada com links de calendário');
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

// Iniciar
startWhatsAppAndSaveQR();

// Manter processo ativo
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando bot...');
  process.exit(0);
});