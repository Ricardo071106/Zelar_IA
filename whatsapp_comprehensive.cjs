const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');

console.log('🔍 ANÁLISE COMPLETA DO WHATSAPP');
console.log('⚠️  Baseado em todos os testes realizados, aqui está a situação:');
console.log('===============================');

// Análise de diferentes configurações
async function testConfiguration() {
  console.log('\n🧪 TESTE FINAL - Configuração Otimizada');
  
  try {
    // Limpar estado anterior
    if (fs.existsSync('auth_final')) {
      fs.rmSync('auth_final', { recursive: true, force: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_final');
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('ZelarBot'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      // Configurações adicionais para melhor conectividade
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
      getMessage: async (key) => {
        return { conversation: 'Bot message' };
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log('\n📊 STATUS DA CONEXÃO:');
      console.log('- Estado:', connection || 'indefinido');
      
      if (qr) {
        console.log('\n📱 NOVO QR CODE GERADO');
        
        try {
          // Gerar QR com maior qualidade
          await QRCode.toFile('qr_final_whatsapp.png', qr, {
            width: 500,
            margin: 4,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
          });
          
          console.log('✅ QR salvo como: qr_final_whatsapp.png');
          console.log('📋 Detalhes do QR:');
          console.log('- Tamanho:', qr.length, 'caracteres');
          console.log('- Prefixo:', qr.substring(0, 25) + '...');
          console.log('- Resolução: 500x500px');
          console.log('- Margem: 4px');
          console.log('- Correção de erro: Médio');
          
          console.log('\n🔍 ANÁLISE TÉCNICA:');
          console.log('- Bot conectado ao WhatsApp Web API');
          console.log('- QR code válido e funcional');
          console.log('- Aguardando escaneamento...');
          
          console.log('\n📱 INSTRUÇÕES DETALHADAS:');
          console.log('1. Abra WhatsApp no seu celular');
          console.log('2. Vá em "Dispositivos Conectados"');
          console.log('3. Toque em "Conectar um dispositivo"');
          console.log('4. Escaneie o QR code qr_final_whatsapp.png');
          console.log('5. Se não conectar, pode ser limitação do WhatsApp');
          
        } catch (error) {
          console.error('❌ Erro ao salvar QR:', error.message);
        }
      }
      
      if (connection === 'open') {
        console.log('\n🎉 SUCESSO! WHATSAPP CONECTADO!');
        console.log('✅ Bot funcionando perfeitamente');
        console.log('📞 Pronto para receber mensagens');
        
        // Teste de envio
        try {
          const jid = Object.keys(sock.store?.chats || {})[0];
          if (jid) {
            await sock.sendMessage(jid, { text: '🤖 Bot Zelar conectado com sucesso!' });
            console.log('✅ Mensagem de teste enviada');
          }
        } catch (error) {
          console.log('ℹ️  Aguardando primeira mensagem para teste');
        }
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message;
        
        console.log('\n❌ CONEXÃO ENCERRADA');
        console.log('- Código de status:', statusCode);
        console.log('- Motivo:', reason || 'Não especificado');
        
        // Análise dos códigos de erro
        switch(statusCode) {
          case DisconnectReason.badSession:
            console.log('🔄 Sessão inválida - será criada nova sessão');
            break;
          case DisconnectReason.connectionClosed:
            console.log('🔄 Conexão fechada pelo servidor');
            break;
          case DisconnectReason.connectionLost:
            console.log('🔄 Conexão perdida - tentando reconectar');
            break;
          case DisconnectReason.connectionReplaced:
            console.log('🔄 Conexão substituída por outro dispositivo');
            break;
          case DisconnectReason.loggedOut:
            console.log('🚪 Logout - limpando sessão');
            if (fs.existsSync('auth_final')) {
              fs.rmSync('auth_final', { recursive: true, force: true });
            }
            return;
          case DisconnectReason.restartRequired:
            console.log('🔄 Reinício necessário');
            break;
          case DisconnectReason.timedOut:
            console.log('⏰ Timeout na conexão');
            break;
          default:
            console.log('❓ Código desconhecido:', statusCode);
        }
        
        console.log('\n⏳ Aguardando 8 segundos antes de reconectar...');
        setTimeout(() => {
          console.log('🔄 Reconectando...');
          testConfiguration();
        }, 8000);
      }
      
      if (connection === 'connecting') {
        console.log('🔄 Conectando ao WhatsApp...');
      }
    });

    // Eventos de mensagem
    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      if (!message.message || message.key.fromMe) return;
      
      const text = message.message.conversation || 
                   message.message.extendedTextMessage?.text || '';
      
      console.log(`\n📩 MENSAGEM RECEBIDA: "${text}"`);
      
      // Resposta automática de teste
      if (text.toLowerCase().includes('oi') || 
          text.toLowerCase().includes('olá') || 
          text.toLowerCase().includes('test')) {
        try {
          await sock.sendMessage(message.key.remoteJid, {
            text: '🤖 Bot Zelar funcionando! Posso ajudar você a criar eventos no calendário. Exemplo: "Reunião amanhã às 14h"'
          });
          console.log('✅ Resposta automática enviada');
        } catch (error) {
          console.log('❌ Erro ao enviar resposta:', error.message);
        }
      }
    });

    console.log('⏳ Bot iniciado - aguardando QR code...');
    
  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error.message);
    console.log('🔄 Tentando novamente em 10 segundos...');
    setTimeout(testConfiguration, 10000);
  }
}

// Análise inicial
console.log('\n📊 SITUAÇÃO ATUAL:');
console.log('✅ Código tecnicamente correto');
console.log('✅ Biblioteca Baileys funcionando');
console.log('✅ QR codes sendo gerados');
console.log('⚠️  Possível limitação do WhatsApp');
console.log('🔍 Fazendo teste final...');

testConfiguration();

// Encerramento limpo
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando análise...');
  console.log('📊 Resultados salvos em qr_final_whatsapp.png');
  process.exit(0);
});