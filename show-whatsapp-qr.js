import qrcode from 'qrcode-terminal';
import fetch from 'node-fetch';

async function showWhatsAppQR() {
  try {
    console.log('🔍 Buscando QR code do WhatsApp...');
    
    const response = await fetch('http://localhost:8080/api/whatsapp/qr');
    const data = await response.json();
    
    if (data.status === 'qr_ready' && data.qrCode) {
      console.log('\n🔗 QR CODE DO WHATSAPP:');
      console.log('Escaneie este QR code com seu WhatsApp para conectar o bot:\n');
      
      qrcode.generate(data.qrCode, { small: true });
      
      console.log('\n📱 Como conectar:');
      console.log('1. Abra o WhatsApp no seu celular');
      console.log('2. Toque em Menu (3 pontos) → Dispositivos conectados');
      console.log('3. Toque em Conectar dispositivo');
      console.log('4. Aponte a câmera para o QR code acima');
      console.log('\n🔗 Ou acesse: http://localhost:8080/api/whatsapp/qr');
    } else {
      console.log('⏳ Aguardando QR code... Tente novamente em alguns segundos');
      console.log('Status:', data.status);
      console.log('Mensagem:', data.message);
    }
  } catch (error) {
    console.error('❌ Erro ao buscar QR code:', error.message);
    console.log('Certifique-se de que o servidor está rodando: npm run start:simple');
  }
}

showWhatsAppQR(); 