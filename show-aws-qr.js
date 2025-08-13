import qrcode from 'qrcode-terminal';
import fetch from 'node-fetch';

async function showAWSQR() {
  try {
    console.log('🔍 Buscando QR code da AWS...');
    
    const response = await fetch('http://telegram-scheduler-prod.eba-ccfz72tn.us-east-1.elasticbeanstalk.com/api/whatsapp/qr');
    const data = await response.json();
    
    if (data.status === 'qr_ready' && data.qrCode) {
      console.log('\n🔗 QR CODE DO WHATSAPP (AWS):');
      console.log('Escaneie este QR code com seu WhatsApp para conectar o bot 24/7:\\n');
      
      qrcode.generate(data.qrCode, { small: true });
      
      console.log('\\n📱 Como conectar:');
      console.log('1. Abra o WhatsApp no seu celular');
      console.log('2. Toque em Menu (3 pontos) → Dispositivos conectados');
      console.log('3. Toque em Conectar dispositivo');
      console.log('4. Aponte a câmera para o QR code acima');
      console.log('\\n🌐 URL da AWS: https://telegram-scheduler-prod.eba-ccfz72tn.us-east-1.elasticbeanstalk.com');
      console.log('✅ O bot funcionará 24/7 na AWS após conectar!');
    } else {
      console.log('❌ QR code não está pronto ainda. Aguarde um momento e tente novamente.');
    }
  } catch (error) {
    console.error('❌ Erro ao buscar QR code:', error.message);
    console.log('\\n🔧 Verifique se a AWS está funcionando:');
    console.log('curl http://telegram-scheduler-prod.eba-ccfz72tn.us-east-1.elasticbeanstalk.com/health');
  }
}

showAWSQR(); 