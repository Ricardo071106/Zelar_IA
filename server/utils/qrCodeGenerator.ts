/**
 * Gerador de QR Code real usando a biblioteca qrcode
 */

import QRCode from 'qrcode';

export async function generateQRCodeBase64(data: string): Promise<string> {
    try {
        const qrCodeBase64 = await QRCode.toDataURL(data, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        console.log('✅ QR Code real gerado! Tamanho:', qrCodeBase64.length);
        return qrCodeBase64;
    } catch (error) {
        console.error('❌ Erro ao gerar QR code:', error);
        throw error;
    }
}

export function generateWhatsAppQRData(): string {
    // Simula dados de conexão WhatsApp
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const sessionId = Math.random().toString(36).substring(2);
    
    return `1@${randomId},${timestamp},${sessionId}`;
}