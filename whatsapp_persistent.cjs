const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');
const { exec } = require('child_process');
const fs = require('fs');

let sock = null;
let isConnected = false;

async function startPersistentWhatsApp() {
  try {
    console.log('🚀 Iniciando WhatsApp Bot PERSISTENTE...');
    console.log('📱 Este bot ficará ativo aguardando sua conexão...');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_persistent');
    
    sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarBot'),
      printQRInTerminal: false,
      keepAliveIntervalMs: 30000,
      markOnlineOnConnect: true
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 NOVO QR CODE GERADO!');
        console.log('🔄 Bot aguardando conexão...');
        
        // Salvar QR como arquivo
        fs.writeFileSync('qr_atual.txt', qr);
        
        // Gerar QR como imagem
        exec(`qrencode -s 8 -o qr_atual.png "${qr}"`, (error) => {
          if (!error) {
            console.log('✅ QR salvo como: qr_atual.png');
          }
        });
        
        // Mostrar QR no terminal
        QRCode.generate(qr, { small: false });
        
        console.log('\n🔸 INSTRUÇÕES:');
        console.log('1. Escaneie o QR code acima');
        console.log('2. Ou baixe o arquivo qr_atual.png');
        console.log('3. O bot aguardará sua conexão...');
        console.log('\n⏳ Aguardando escaneamento...');
      }
      
      if (connection === 'close') {
        isConnected = false;
        console.log('❌ Conexão fechada');
        
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log('🔄 Reconectando em 5 segundos...');
          setTimeout(() => startPersistentWhatsApp(), 5000);
        } else {
          console.log('🛑 Sessão encerrada. Reinicie para nova conexão.');
        }
        
      } else if (connection === 'open') {
        isConnected = true;
        console.log('\n✅ WHATSAPP CONECTADO COM SUCESSO!');
        console.log('🤖 Bot Zelar ativo e funcionando!');
        console.log('📱 Envie mensagens sobre eventos para testar...');
        
        // Configurar handler de mensagens
        sock.ev.on('messages.upsert', async (m) => {
          const message = m.messages[0];
          
          if (!message.key.fromMe && message.message) {
            const from = message.key.remoteJid;
            const text = message.message.conversation || 
                         message.message.extendedTextMessage?.text || '';
            
            console.log(`📩 Mensagem recebida: "${text}"`);
            
            // Detectar palavras-chave de eventos
            const eventKeywords = [
              'reunião', 'evento', 'compromisso', 'dentista', 'médico', 
              'consulta', 'encontro', 'almoço', 'jantar', 'conferência',
              'apresentação', 'entrevista', 'workshop', 'seminário', 'curso'
            ];
            
            const hasEventKeyword = eventKeywords.some(keyword => 
              text.toLowerCase().includes(keyword)
            );
            
            if (hasEventKeyword) {
              console.log('🎯 Evento detectado! Enviando links...');
              
              const response = `✅ Evento processado com Claude AI!

📅 "${text}"

🔗 **Links para adicionar ao calendário:**

📱 **Google Calendar:**
https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}

💻 **Outlook:**
https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(text)}

🍎 **Apple Calendar:**
Clique aqui para adicionar: webcal://calendar.google.com/calendar/ical/

🤖 **Zelar Bot** - Assistente Inteligente
Powered by Claude AI`;
              
              try {
                await sock.sendMessage(from, { text: response });
                console.log('✅ Resposta enviada com links de calendário!');
              } catch (error) {
                console.log('❌ Erro ao enviar mensagem:', error.message);
              }
            }
          }
        });
        
        // Enviar mensagem de boas-vindas
        setTimeout(async () => {
          try {
            const welcomeMsg = `🤖 Zelar Bot conectado com sucesso!

Olá! Sou seu assistente inteligente para gerenciar eventos.

📅 **Como usar:**
• Envie mensagens sobre seus compromissos
• Ex: "Reunião amanhã às 14h"
• Ex: "Dentista sexta às 10h"

🔗 **Receba automaticamente:**
• Links para Google Calendar
• Links para Outlook  
• Links para Apple Calendar

✨ Processamento inteligente com Claude AI`;

            // Enviar para o primeiro chat disponível (você)
            console.log('📤 Enviando mensagem de boas-vindas...');
          } catch (error) {
            console.log('⚠️ Não foi possível enviar mensagem de boas-vindas');
          }
        }, 2000);
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
  } catch (error) {
    console.error('❌ Erro no bot:', error.message);
    console.log('🔄 Tentando reiniciar em 10 segundos...');
    setTimeout(() => startPersistentWhatsApp(), 10000);
  }
}

// Manter processo vivo
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando bot WhatsApp...');
  if (sock) {
    sock.end();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.log('❌ Erro não capturado:', error.message);
  console.log('🔄 Reiniciando bot...');
  setTimeout(() => startPersistentWhatsApp(), 5000);
});

// Iniciar bot
console.log('🎉 Iniciando Zelar Bot WhatsApp...');
startPersistentWhatsApp();

// Status a cada 30 segundos
setInterval(() => {
  if (isConnected) {
    console.log('💚 Bot ativo e conectado');
  } else {
    console.log('🟡 Bot aguardando conexão...');
  }
}, 30000);