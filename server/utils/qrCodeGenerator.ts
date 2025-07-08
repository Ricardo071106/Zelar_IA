/**
 * Gerador de QR Code para WhatsApp
 * Converte texto em imagem PNG base64
 */

import QRCode from 'qrcode';

export async function generateQRCodeImage(text: string): Promise<string> {
  try {
    // Gerar QR code como imagem PNG em base64 com configurações otimizadas para WhatsApp
    const qrCodeDataURL = await QRCode.toDataURL(text, {
      type: 'image/png',
      width: 512,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M',
      rendererOpts: {
        quality: 0.9
      }
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Erro ao gerar QR code:', error);
    throw error;
  }
}

export async function generateQRCodeBuffer(text: string): Promise<Buffer> {
  try {
    // Gerar QR code como buffer PNG
    const buffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return buffer;
  } catch (error) {
    console.error('Erro ao gerar QR code buffer:', error);
    throw error;
  }
}