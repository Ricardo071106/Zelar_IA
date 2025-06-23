import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

console.log('🚀 Conectando seu WhatsApp Business...');
console.log('📱 Aguarde o QR Code aparecer abaixo');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './business-session'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n' + '='.repeat(60));
    console.log('📱 ESCANEIE ESTE QR CODE COM SEU WHATSAPP BUSINESS:');
    console.log('='.repeat(60));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(60));
    console.log('📋 PASSOS:');
    console.log('1. Abra WhatsApp Business no celular');
    console.log('2. Menu → Dispositivos conectados');
    console.log('3. Conectar dispositivo');
    console.log('4. Escaneie o código acima');
    console.log('='.repeat(60));
});

client.on('ready', () => {
    console.log('\n✅ CONECTADO COM SUCESSO!');
    const info = client.info;
    console.log(`📋 Conta: ${info.pushname}`);
    console.log(`📞 Número: ${info.wid.user}`);
    console.log(`🏢 Business: ${info.isBusiness ? 'SIM' : 'NÃO'}`);
    
    if (info.isBusiness) {
        console.log('🎉 Sua conta WhatsApp Business está conectada!');
    } else {
        console.log('⚠️  Esta não é uma conta Business. Use o app WhatsApp Business.');
    }
});

client.on('message', async (message) => {
    if (!message.fromMe) {
        console.log(`📩 Mensagem de ${message.from}: ${message.body}`);
        
        await message.reply(`🏢 Olá! Seu WhatsApp Business está conectado ao Zelar!

Agora posso processar seus eventos empresariais:
• "Reunião diretoria amanhã 14h"
• "Apresentação clientes sexta 10h"  
• "Workshop equipe segunda 9h"

Como posso ajudar sua empresa?`);
    }
});

client.on('disconnected', () => {
    console.log('📴 Desconectado. Execute novamente para reconectar.');
});

client.initialize();