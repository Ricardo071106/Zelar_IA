/**
 * Teste para verificar se o QR code WhatsApp está funcionando
 */

import { generateQRCodeImage } from '../utils/qrCodeGenerator';

async function testQRCode() {
  try {
    console.log('🧪 Testando geração de QR Code WhatsApp...');
    
    // Simular dados do WhatsApp
    const whatsappData = '1@testserver123,testbrowser456,testsecret789012345,1751946280000';
    
    // Gerar QR code
    const qrImage = await generateQRCodeImage(whatsappData);
    
    console.log('✅ QR Code gerado com sucesso!');
    console.log('📏 Tamanho:', qrImage.length);
    console.log('🎨 Formato:', qrImage.substring(0, 50) + '...');
    
    // Verificar se é uma imagem PNG válida
    if (qrImage.startsWith('data:image/png;base64,')) {
      console.log('✅ Formato PNG válido');
    } else {
      console.log('❌ Formato inválido');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return false;
  }
}

// Executar teste
if (require.main === module) {
  testQRCode();
}

export { testQRCode };