const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');

console.log('🔍 ANÁLISE FINAL DO WHATSAPP');
console.log('===============================');

// Análise de múltiplas configurações
const configurations = [
  {
    name: 'Configuração Padrão',
    config: {
      browser: Browsers.ubuntu('ZelarBot'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 60000
    }
  },
  {
    name: 'Configuração Chrome',
    config: {
      browser: Browsers.chrome('ZelarBot'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 30000
    }
  },
  {
    name: 'Configuração Edge',
    config: {
      browser: Browsers.edge('ZelarBot'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 90000
    }
  }
];

let currentConfig = 0;
let qrCount = 0;

async function testConfiguration(config) {
  console.log(`\n🧪 TESTANDO: ${config.name}`);
  console.log('Browser:', config.config.browser);
  
  try {
    // Limpar estado anterior
    if (fs.existsSync('auth_analysis')) {
      fs.rmSync('auth_analysis', { recursive: true, force: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_analysis');
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      ...config.config,
      getMessage: async (key) => {
        return { conversation: 'Bot message' };
      }
    });

    return new Promise((resolve) => {
      let timeout;
      
      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          qrCount++;
          console.log(`📱 QR CODE #${qrCount} GERADO`);
          
          const fileName = `qr_${config.name.toLowerCase().replace(/\s+/g, '_')}_${qrCount}.png`;
          
          try {
            await QRCode.toFile(fileName, qr, {
              width: 300,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            
            console.log(`✅ QR salvo como: ${fileName}`);
            console.log(`📋 Tamanho: ${qr.length} chars`);
            
            // Timeout para próxima configuração
            timeout = setTimeout(() => {
              console.log('⏰ Timeout - tentando próxima configuração...');
              sock.end();
              resolve('timeout');
            }, 30000);
            
          } catch (error) {
            console.error('❌ Erro ao salvar QR:', error.message);
          }
        }
        
        if (connection === 'open') {
          console.log(`🎉 SUCESSO COM: ${config.name}`);
          clearTimeout(timeout);
          resolve('success');
        }
        
        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          console.log(`❌ FALHA: ${config.name} - Código: ${statusCode}`);
          clearTimeout(timeout);
          resolve('failed');
        }
      });
    });
    
  } catch (error) {
    console.error(`❌ ERRO EM ${config.name}:`, error.message);
    return 'error';
  }
}

async function runAnalysis() {
  console.log('🚀 Iniciando análise completa...\n');
  
  for (const config of configurations) {
    const result = await testConfiguration(config);
    
    if (result === 'success') {
      console.log(`\n✅ CONFIGURAÇÃO FUNCIONOU: ${config.name}`);
      console.log('🎯 Use esta configuração para o bot final!');
      break;
    }
    
    console.log(`\n📊 Resultado: ${result}`);
    console.log('⏳ Aguardando 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n📊 ANÁLISE COMPLETA FINALIZADA');
  console.log('===============================');
  console.log(`Total de QR codes gerados: ${qrCount}`);
  console.log('Verifique os arquivos QR gerados para teste');
  
  // Relatório final
  const files = fs.readdirSync('.').filter(f => f.startsWith('qr_') && f.endsWith('.png'));
  console.log('\n📁 Arquivos QR gerados:');
  files.forEach(file => console.log(`- ${file}`));
}

runAnalysis().catch(console.error);

// Encerramento limpo
process.on('SIGINT', () => {
  console.log('\n🛑 Análise interrompida pelo usuário');
  process.exit(0);
});