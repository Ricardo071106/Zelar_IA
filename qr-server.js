import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';

const app = express();
let qrString = '';
let isConnected = false;
let clientInfo = null;

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './qr-session'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrString = qr;
    console.log('📱 QR Code atualizado');
});

client.on('ready', () => {
    isConnected = true;
    qrString = '';
    clientInfo = client.info;
    console.log('✅ Conectado:', clientInfo.pushname);
});

client.on('disconnected', () => {
    isConnected = false;
    qrString = '';
    clientInfo = null;
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Business QR</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
    <style>
        body { font-family: Arial; text-align: center; padding: 20px; }
        .qr-container { margin: 20px auto; max-width: 300px; }
        .status { padding: 15px; margin: 20px; border-radius: 8px; }
        .connected { background: #d4edda; color: #155724; }
        .waiting { background: #fff3cd; color: #856404; }
        .error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <h1>📱 WhatsApp Business</h1>
    <div id="status" class="status">${isConnected ? 'Conectado' : qrString ? 'Escaneie o QR Code' : 'Gerando QR Code...'}</div>
    
    ${isConnected ? `
        <div class="status connected">
            ✅ Conectado com sucesso!<br>
            ${clientInfo ? `Conta: ${clientInfo.pushname}<br>Business: ${clientInfo.isBusiness ? 'Sim' : 'Não'}` : ''}
        </div>
    ` : qrString ? `
        <div class="qr-container">
            <canvas id="qr"></canvas>
        </div>
        <div class="status waiting">
            <strong>Passos:</strong><br>
            1. Abra WhatsApp Business<br>
            2. Menu → Dispositivos conectados<br>
            3. Conectar dispositivo<br>
            4. Escaneie o código acima
        </div>
    ` : `
        <div class="status error">
            Aguardando QR Code...
        </div>
    `}
    
    <script>
        ${qrString ? `
            QRCode.toCanvas(document.getElementById('qr'), '${qrString}', function (error) {
                if (error) console.error(error);
            });
        ` : ''}
        
        setTimeout(() => location.reload(), 5000);
    </script>
</body>
</html>
    `);
});

app.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        hasQR: !!qrString,
        qr: qrString,
        info: clientInfo
    });
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`🌐 QR Code disponível em: http://localhost:${PORT}`);
});

client.initialize();