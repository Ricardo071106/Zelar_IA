import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';

// Configuração do Express
const app = express();
app.use(express.json());

// Configuração do cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// Event: QR Code gerado
client.on('qr', (qr) => {
    console.log('\n🔗 QR Code gerado! Escaneie com seu WhatsApp:');
    console.log('WhatsApp → Menu (⋮) → Dispositivos conectados → Conectar dispositivo\n');
    qrcode.generate(qr, { small: true });
});

// Event: Cliente pronto
client.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
    console.log('🤖 Bot Zelar ativo e funcionando');
    console.log('📱 Aguardando mensagens...\n');
});

// Event: Mensagem recebida
client.on('message', async (message) => {
    try {
        // Evita responder para próprias mensagens ou grupos
        if (message.fromMe || message.from.includes('@g.us')) {
            return;
        }

        const contact = await message.getContact();
        const contactName = contact.pushname || contact.number;
        
        console.log(`📨 Mensagem recebida de ${contactName} (${message.from}): ${message.body}`);

        // Resposta automática de boas-vindas
        const welcomeMessage = 'Olá! Seja bem-vindo ao Zelar! 🌟';
        
        await message.reply(welcomeMessage);
        
        console.log(`✅ Resposta enviada para ${contactName}: ${welcomeMessage}`);
        
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

// Event: Autenticação bem-sucedida
client.on('authenticated', () => {
    console.log('✅ Autenticação realizada com sucesso!');
});

// Event: Falha na autenticação
client.on('auth_failure', (message) => {
    console.error('❌ Falha na autenticação:', message);
});

// Event: Cliente desconectado
client.on('disconnected', (reason) => {
    console.log('❌ Cliente desconectado:', reason);
});

// Rota para enviar mensagens via API
app.post('/send', async (req, res) => {
    try {
        const { number, message } = req.body;

        if (!number || !message) {
            return res.status(400).json({
                success: false,
                error: 'Campos "number" e "message" são obrigatórios'
            });
        }

        // Formatar número (adicionar @c.us se necessário)
        let formattedNumber = number.replace(/\D/g, ''); // Remove caracteres não numéricos
        
        if (!formattedNumber.includes('@')) {
            formattedNumber = formattedNumber + '@c.us';
        }

        // Verificar se o número é válido
        const numberId = await client.getNumberId(formattedNumber);
        
        if (!numberId) {
            return res.status(400).json({
                success: false,
                error: 'Número não encontrado no WhatsApp'
            });
        }

        // Enviar mensagem
        await client.sendMessage(numberId._serialized, message);
        
        console.log(`📤 Mensagem enviada via API para ${number}: ${message}`);
        
        res.json({
            success: true,
            message: 'Mensagem enviada com sucesso',
            to: number,
            content: message
        });

    } catch (error) {
        console.error('❌ Erro ao enviar mensagem via API:', error);
        
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Rota de status
app.get('/status', (req, res) => {
    const clientState = client.info ? 'Conectado' : 'Desconectado';
    
    res.json({
        status: clientState,
        timestamp: new Date().toISOString(),
        info: client.info || null
    });
});

// Rota básica
app.get('/', (req, res) => {
    res.json({
        message: 'WhatsApp Bot Zelar API',
        endpoints: {
            'POST /send': 'Enviar mensagem (body: {number, message})',
            'GET /status': 'Status da conexão',
            'GET /': 'Esta página'
        }
    });
});

// Inicializar o cliente WhatsApp
console.log('🚀 Iniciando WhatsApp Bot Zelar...');
console.log('📡 Aguardando conexão...\n');

client.initialize();

// Inicializar servidor Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor Express rodando na porta ${PORT}`);
    console.log(`📍 Acesse: http://localhost:${PORT}`);
    console.log(`📤 API de envio: POST http://localhost:${PORT}/send\n`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Rejeição não tratada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exceção não capturada:', error);
});