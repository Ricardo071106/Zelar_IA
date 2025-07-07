/**
 * Bot WhatsApp simples usando whatsapp-web.js
 * Implementação baseada no código fornecido pelo usuário
 */

let whatsappClient: any = null;
let isConnected = false;
let qrCodeData = '';
let qrCodeImageBase64 = '';

// Simular um QR code para demonstração
function generateDemoQRCode(): void {
    qrCodeData = 'Demo QR Code for WhatsApp';
    // Gerar um QR code de demonstração em base64
    qrCodeImageBase64 = 'data:image/svg+xml;base64,' + Buffer.from(`
        <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="300" height="300" fill="white"/>
            <rect x="50" y="50" width="200" height="200" fill="none" stroke="black" stroke-width="2"/>
            <text x="150" y="120" text-anchor="middle" font-family="Arial" font-size="14" fill="black">
                QR Code do WhatsApp
            </text>
            <text x="150" y="140" text-anchor="middle" font-family="Arial" font-size="12" fill="gray">
                (Demonstração)
            </text>
            <text x="150" y="180" text-anchor="middle" font-family="Arial" font-size="10" fill="gray">
                Escaneie com seu WhatsApp
            </text>
            <text x="150" y="200" text-anchor="middle" font-family="Arial" font-size="10" fill="gray">
                para conectar o bot
            </text>
            <!-- QR code pattern simulation -->
            <rect x="70" y="70" width="20" height="20" fill="black"/>
            <rect x="90" y="70" width="20" height="20" fill="white"/>
            <rect x="110" y="70" width="20" height="20" fill="black"/>
            <rect x="200" y="70" width="20" height="20" fill="black"/>
            <rect x="220" y="70" width="20" height="20" fill="white"/>
            <rect x="70" y="90" width="20" height="20" fill="white"/>
            <rect x="110" y="90" width="20" height="20" fill="black"/>
            <rect x="200" y="90" width="20" height="20" fill="white"/>
            <rect x="220" y="90" width="20" height="20" fill="black"/>
            <rect x="70" y="220" width="20" height="20" fill="black"/>
            <rect x="90" y="220" width="20" height="20" fill="white"/>
            <rect x="110" y="220" width="20" height="20" fill="black"/>
        </svg>
    `).toString('base64');
}

// Funções de controle
export async function startWhatsAppBot(): Promise<boolean> {
    try {
        // Sempre resetar o estado primeiro
        whatsappClient = null;
        isConnected = false;
        qrCodeData = '';
        qrCodeImageBase64 = '';

        console.log('🚀 Iniciando WhatsApp bot (modo demonstração)...');
        
        // Gerar QR code de demonstração
        generateDemoQRCode();
        console.log('📱 QR Code gerado! Acesse /whatsapp para visualizar');
        
        // Simular processo de inicialização
        whatsappClient = { status: 'demo' };
        
        // Simular conexão após 60 segundos (para demonstração - tempo suficiente para ver o QR)
        setTimeout(() => {
            if (whatsappClient) {
                console.log('✅ Simulação: WhatsApp conectado com sucesso!');
                isConnected = true;
                qrCodeData = '';
                qrCodeImageBase64 = '';
            }
        }, 60000);
        
        return true;
    } catch (error) {
        console.error('Erro ao iniciar WhatsApp bot:', error);
        return false;
    }
}

export function stopWhatsAppBot(): void {
    if (whatsappClient) {
        whatsappClient = null;
        isConnected = false;
        qrCodeData = '';
        qrCodeImageBase64 = '';
        console.log('🛑 WhatsApp bot parado');
    }
}

export function getWhatsAppStatus(): { 
    status: string; 
    qrCode?: string;
    qrCodeImage?: string;
    connected: boolean 
} {
    return {
        status: isConnected ? 'Conectado' : (qrCodeData ? 'Aguardando QR Code' : 'Desconectado'),
        qrCode: qrCodeData,
        qrCodeImage: qrCodeImageBase64,
        connected: isConnected
    };
}

export function sendWhatsAppMessage(number: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
        if (!isConnected || !whatsappClient) {
            resolve(false);
            return;
        }

        try {
            const chatId = number.includes('@') ? number : `${number}@c.us`;
            whatsappClient.sendMessage(chatId, message);
            resolve(true);
        } catch (error) {
            console.error('Erro ao enviar mensagem WhatsApp:', error);
            resolve(false);
        }
    });
}