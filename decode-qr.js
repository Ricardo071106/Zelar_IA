import https from 'https';
import fs from 'fs';

// Função para fazer requisição HTTPS
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Função para decodificar base64 e salvar como imagem
function decodeAndSaveQR() {
  const url = 'https://telegram-scheduler-prod.eba-ccfz72tn.us-east-1.elasticbeanstalk.com/api/whatsapp/qr';
  
  console.log('🔍 Obtendo QR code...');
  
  makeRequest(url)
    .then(response => {
      try {
        const data = JSON.parse(response);
        
        if (data.status === 'qr_ready' && data.qrImage) {
          console.log('✅ QR Code encontrado!');
          
          // Extrair o base64 (remover o prefixo data:image/png;base64,)
          const base64Data = data.qrImage.replace('data:image/png;base64,', '');
          
          // Converter base64 para buffer
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Salvar como arquivo PNG
          fs.writeFileSync('whatsapp-qr.png', imageBuffer);
          
          console.log('🎉 QR Code salvo como "whatsapp-qr.png"');
          console.log('📱 Abra o arquivo "whatsapp-qr.png" e escaneie com seu WhatsApp!');
          console.log('');
          console.log('📋 Como conectar:');
          console.log('1. Abra o WhatsApp no seu celular');
          console.log('2. Toque em Menu (3 pontos) → Dispositivos conectados');
          console.log('3. Toque em Conectar dispositivo');
          console.log('4. Aponte a câmera para o QR code no arquivo "whatsapp-qr.png"');
          
        } else {
          console.log('❌ QR Code não está pronto ainda. Status:', data.status);
          console.log('⏳ Aguarde alguns segundos e tente novamente.');
        }
      } catch (error) {
        console.log('❌ Erro ao processar resposta:', error.message);
      }
    })
    .catch(error => {
      console.log('❌ Erro ao fazer requisição:', error.message);
    });
}

// Executar o script
decodeAndSaveQR(); 