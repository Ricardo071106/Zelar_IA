import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import fs from 'fs';

console.log('🚀 Gerando QR Code para WhatsApp Business - Zelar Assistant');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-business-session'
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

// QR Code para primeira conexão
client.on('qr', async (qr) => {
    console.log('\n=== QR CODE GERADO ===');
    
    // Salvar QR code como imagem
    try {
        await QRCode.toFile('./public/whatsapp-qr.png', qr, {
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        console.log('✅ QR Code salvo como imagem em: ./public/whatsapp-qr.png');
        console.log('📱 Acesse o arquivo para visualizar e escanear com seu WhatsApp Business');
        
        // Também gerar para terminal
        const qrTerminal = await QRCode.toString(qr, { type: 'terminal', small: true });
        console.log('\n📱 QR Code para terminal:');
        console.log(qrTerminal);
        
    } catch (error) {
        console.error('❌ Erro ao gerar QR code:', error);
    }
    
    console.log('\n📋 Código QR em texto (backup):');
    console.log(qr);
    console.log('\n🔄 Escaneie com WhatsApp Business → Dispositivos conectados → Conectar dispositivo');
    console.log('⏱️  QR Code expira em 60 segundos, após isso um novo será gerado');
});

// Bot conectado
client.on('ready', () => {
    const info = client.info;
    console.log('\n✅ WhatsApp Business conectado com sucesso!');
    console.log(`📞 Número: ${info.wid.user}`);
    console.log(`🏢 Empresa: ${info.pushname}`);
    console.log('🤖 Sistema pronto para processar mensagens automaticamente');
    
    // Salvar informações de conexão
    const connectionInfo = {
        connected: true,
        phoneNumber: info.wid.user,
        businessName: info.pushname,
        connectedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('./whatsapp-connection.json', JSON.stringify(connectionInfo, null, 2));
    console.log('💾 Informações de conexão salvas em whatsapp-connection.json');
});

client.on('disconnected', (reason) => {
    console.log('📴 WhatsApp Business desconectado:', reason);
    console.log('🔄 Execute novamente para reconectar');
    
    // Limpar arquivo de conexão
    if (fs.existsSync('./whatsapp-connection.json')) {
        fs.unlinkSync('./whatsapp-connection.json');
    }
});

client.on('message', async (message) => {
    if (message.fromMe) return;
    
    const userMessage = message.body;
    const userName = message._data.notifyName || 'Cliente';
    
    console.log(`📩 Mensagem recebida de ${userName}: ${userMessage}`);
    
    // Aqui ficaria o processamento de eventos
    // Por enquanto, apenas registra a mensagem
});

// Inicializar cliente
client.initialize();

// Manter o processo ativo
process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando WhatsApp Business...');
    client.destroy();
    process.exit(0);
});