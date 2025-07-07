/**
 * Bot WhatsApp simples usando whatsapp-web.js
 * Implementação baseada no código fornecido pelo usuário
 */

let whatsappClient: any = null;
let isConnected = false;
let qrCodeData = '';
let qrCodeImageBase64 = '';
let WhatsAppModules: any = null;

// Função para carregar módulos WhatsApp dinamicamente
async function loadWhatsAppModules() {
    if (!WhatsAppModules) {
        try {
            // Usar dynamic import para compatibilidade ESM
            const whatsappWeb = await import('whatsapp-web.js');
            const qrcodeTerminal = await import('qrcode-terminal');
            const qrcodeImage = await import('qrcode');
            
            WhatsAppModules = {
                Client: whatsappWeb.Client,
                LocalAuth: whatsappWeb.LocalAuth,
                qrcodeTerminal: qrcodeTerminal.default,
                qrcodeImage: qrcodeImage.default
            };
        } catch (error) {
            console.error('Erro ao carregar módulos WhatsApp:', error);
            throw error;
        }
    }
    return WhatsAppModules;
}

// Funções de controle
export async function startWhatsAppBot(): Promise<boolean> {
    try {
        if (whatsappClient) {
            console.log('WhatsApp bot já está iniciado');
            return true;
        }

        const modules = await loadWhatsAppModules();
        const { Client, LocalAuth, qrcodeTerminal, qrcodeImage } = modules;

        // Cria o cliente WhatsApp
        const client = new Client({
            authStrategy: new LocalAuth()
        });

        // Gera o QR Code no terminal e como imagem
        client.on('qr', async (qr: string) => {
            qrCodeData = qr;
            qrcodeTerminal.generate(qr, { small: true });
            console.log('📱 Escaneie o QR Code com o WhatsApp do número que deseja usar!');
            
            // Gerar QR code como imagem base64
            try {
                qrCodeImageBase64 = await qrcodeImage.toDataURL(qr, {
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
            } catch (error) {
                console.error('Erro ao gerar QR code como imagem:', error);
            }
        });

        // Confirmação quando estiver pronto
        client.on('ready', () => {
            console.log('✅ Zelar conectado e funcionando no WhatsApp!');
            isConnected = true;
            qrCodeData = '';
            qrCodeImageBase64 = '';
        });

        // Responde mensagens automaticamente
        client.on('message', (message: any) => {
            const msg = message.body.toLowerCase();

            if (msg === 'oi' || msg === 'olá') {
                message.reply('Olá! Aqui é o Zelar 🦾 Posso te ajudar a lembrar de algo?');
            } else if (msg.includes('lembrete')) {
                message.reply('Anotado! Seu lembrete foi registrado. ✅');
            } else {
                message.reply('Desculpe, não entendi. Me diga "lembrete" ou "oi" para começar!');
            }
        });

        whatsappClient = client;
        client.initialize();
        
        console.log('🚀 WhatsApp bot iniciando...');
        return true;
    } catch (error) {
        console.error('Erro ao iniciar WhatsApp bot:', error);
        return false;
    }
}

export function stopWhatsAppBot(): void {
    if (whatsappClient) {
        whatsappClient.destroy();
        whatsappClient = null;
        isConnected = false;
        qrCodeData = '';
        qrCodeImageBase64 = '';
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