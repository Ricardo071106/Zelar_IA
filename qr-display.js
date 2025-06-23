import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';

const app = express();
let currentQR = null;
let connectionStatus = 'Aguardando QR Code...';
let businessInfo = null;

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
    currentQR = qr;
    connectionStatus = 'QR Code gerado - Escaneie com WhatsApp Business';
    console.log('📱 QR Code atualizado para interface web');
});

client.on('ready', () => {
    connectionStatus = 'Conectado com sucesso!';
    currentQR = null;
    businessInfo = {
        name: client.info.pushname,
        number: client.info.wid.user,
        isBusiness: client.info.isBusiness
    };
    console.log('✅ WhatsApp Business conectado:', businessInfo);
});

client.on('disconnected', () => {
    connectionStatus = 'Desconectado';
    currentQR = null;
    businessInfo = null;
});

// Rotas web
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conectar WhatsApp Business</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f0f2f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            text-align: center;
        }
        .status {
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-weight: bold;
            font-size: 18px;
        }
        .status.waiting {
            background: #fff3cd;
            color: #856404;
        }
        .status.connected {
            background: #d4edda;
            color: #155724;
        }
        .qr-container {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border: 2px solid #007bff;
        }
        .steps {
            text-align: left;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .step {
            margin: 10px 0;
            padding: 10px;
            background: white;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        .btn:hover {
            background: #0056b3;
        }
        #qrcode {
            margin: 20px auto;
            max-width: 300px;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>📱 Conectar WhatsApp Business</h1>
        
        <div id="status" class="status waiting">${connectionStatus}</div>
        
        <div id="qr-section" style="${currentQR ? 'display: block' : 'display: none'}">
            <h2>Escaneie com seu WhatsApp Business:</h2>
            <div class="qr-container">
                <canvas id="qrcode"></canvas>
            </div>
        </div>

        <div class="steps">
            <h3>Como conectar:</h3>
            <div class="step">📱 <strong>1. Abra WhatsApp Business</strong> no celular</div>
            <div class="step">⋮ <strong>2. Menu → Dispositivos conectados</strong></div>
            <div class="step">🔗 <strong>3. Conectar dispositivo</strong></div>
            <div class="step">📷 <strong>4. Escaneie o QR Code acima</strong></div>
        </div>

        <button class="btn" onclick="location.reload()">Atualizar Status</button>
        <button class="btn" onclick="window.open('/status', '_blank')">Ver Detalhes</button>
    </div>

    <script>
        const qrData = '${currentQR || ''}';
        if (qrData) {
            QRCode.toCanvas(document.getElementById('qrcode'), qrData, function (error) {
                if (error) console.error(error);
                console.log('QR Code gerado com sucesso!');
            });
        }

        // Auto-refresh a cada 5 segundos
        setTimeout(() => location.reload(), 5000);
    </script>
</body>
</html>
    `);
});

app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        hasQR: !!currentQR,
        qrCode: currentQR,
        businessInfo: businessInfo,
        timestamp: new Date().toISOString()
    });
});

const PORT = 3333;
app.listen(PORT, () => {
    console.log(`\n🌐 Interface disponível em: http://localhost:${PORT}`);
    console.log('📱 Acesse para ver o QR Code do WhatsApp Business\n');
});

client.initialize();