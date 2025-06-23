import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

console.log('🚀 Iniciando conexão WhatsApp Business...');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './business-connect-session'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('\n' + '='.repeat(80));
    console.log('📱 ESCANEIE COM SEU WHATSAPP BUSINESS:');
    console.log('='.repeat(80));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(80));
    console.log('PASSOS:');
    console.log('1. Abra WhatsApp Business no celular');
    console.log('2. Menu (3 pontos) → Dispositivos conectados');
    console.log('3. Conectar dispositivo');
    console.log('4. Escaneie o código acima');
    console.log('='.repeat(80));
});

client.on('ready', () => {
    const info = client.info;
    console.log('\n✅ CONECTADO COM SUCESSO!');
    console.log(`Conta: ${info.pushname}`);
    console.log(`Número: ${info.wid.user}`);
    console.log(`Business: ${info.isBusiness ? 'SIM' : 'NÃO'}`);
    
    if (info.isBusiness) {
        console.log('\n🎉 Sua conta WhatsApp Business está funcionando!');
        console.log('Agora pode enviar mensagens e criar eventos.');
    }
});

client.on('message', async (msg) => {
    if (!msg.fromMe) {
        console.log(`📩 Nova mensagem: ${msg.body}`);
        await msg.reply('✅ WhatsApp Business conectado ao Zelar! Posso processar seus eventos empresariais.');
    }
});

client.initialize();