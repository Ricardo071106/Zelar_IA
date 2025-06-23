/**
 * Script para testar a API do WhatsApp
 */

const https = require('https');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testWhatsAppAPI() {
  console.log('🧪 Testando API do WhatsApp...\n');

  try {
    // Teste 1: Verificar status
    console.log('1. Verificando status da conexão...');
    const statusResponse = await makeRequest('/status');
    console.log(`Status: ${statusResponse.statusCode}`);
    console.log(`Resposta:`, statusResponse.data);
    
    if (statusResponse.data.status === 'connected') {
      console.log('✅ WhatsApp conectado - pronto para enviar mensagens!');
      
      // Teste 2: Enviar mensagem de teste (comentado para não spammar)
      /*
      console.log('\n2. Testando envio de mensagem...');
      const sendResponse = await makeRequest('/send-message', 'POST', {
        number: '5511999999999', // Número de teste
        message: 'Teste do bot Zelar - mensagem automática'
      });
      console.log(`Envio: ${sendResponse.statusCode}`);
      console.log(`Resposta:`, sendResponse.data);
      */
      
    } else {
      console.log('⏳ WhatsApp não conectado ainda - escaneie o QR Code');
      
      // Teste 3: Obter QR Code
      console.log('\n2. Obtendo QR Code...');
      const qrResponse = await makeRequest('/qr');
      console.log(`QR: ${qrResponse.statusCode}`);
      if (qrResponse.data.qrCode) {
        console.log('✅ QR Code disponível para escaneamento');
      } else {
        console.log('⏳ QR Code ainda não gerado');
      }
    }

  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
    console.log('ℹ️  Certifique-se de que o bot está rodando na porta 3000');
  }
}

// Aguardar um pouco e testar
setTimeout(testWhatsAppAPI, 5000);