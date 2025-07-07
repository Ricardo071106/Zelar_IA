/**
 * Bot WhatsApp simples usando whatsapp-web.js
 * Implementação baseada no código fornecido pelo usuário
 */

let whatsappClient: any = null;
let isConnected = false;
let qrCodeData = '';
let WhatsAppModules: any = null;

// Função para carregar módulos WhatsApp dinamicamente
async function loadWhatsAppModules() {
    if (!WhatsAppModules) {
        try {
            // Usar dynamic import para compatibilidade ESM
            const whatsappWeb = await import('whatsapp-web.js');
            const qrcode = await import('qrcode-terminal');
            
            WhatsAppModules = {
                Client: whatsappWeb.Client,
                LocalAuth: whatsappWeb.LocalAuth,
                qrcode: qrcode.default
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
        const { Client, LocalAuth, qrcode } = modules;

        // Cria o cliente WhatsApp
        const client = new Client({
            authStrategy: new LocalAuth()
        });

        // Gera o QR Code no terminal
        client.on('qr', (qr: string) => {
            qrCodeData = qr;
            qrcode.generate(qr, { small: true });
            console.log('📱 Escaneie o QR Code com o WhatsApp do número que deseja usar!');
        });

        // Confirmação quando estiver pronto
        client.on('ready', () => {
            console.log('✅ Zelar conectado e funcionando no WhatsApp!');
            isConnected = true;
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
    }
}

export function getWhatsAppStatus(): { 
    status: string; 
    qrCode?: string; 
    connected: boolean 
} {
    return {
        status: isConnected ? 'Conectado' : (qrCodeData ? 'Aguardando QR Code' : 'Desconectado'),
        qrCode: qrCodeData,
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