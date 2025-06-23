import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';

console.log('Iniciando gerador de QR Code WhatsApp Business...');

const app = express();
let currentQR = '';
let connectionStatus = 'Aguardando...';

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './business-qr-session'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    currentQR = qr;
    connectionStatus = 'QR Code disponível';
    console.log('QR Code gerado - acesse http://localhost:3030');
});

client.on('ready', () => {
    connectionStatus = 'Conectado';
    currentQR = '';
    console.log('WhatsApp Business conectado!');
});

app.get('/', (req, res) => {
    if (currentQR) {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>QR Code WhatsApp Business</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
    <style>
        body { 
            font-family: Arial; 
            text-align: center; 
            padding: 40px; 
            background: #f0f2f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        h1 { color: #007bff; margin-bottom: 30px; }
        #qr { margin: 30px auto; }
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
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 WhatsApp Business</h1>
        <p><strong>Status:</strong> ${connectionStatus}</p>
        
        <canvas id="qr"></canvas>
        
        <div class="steps">
            <h3>Como conectar:</h3>
            <div class="step"><strong>1.</strong> Abra WhatsApp Business no celular</div>
            <div class="step"><strong>2.</strong> Menu (3 pontos) → Dispositivos conectados</div>
            <div class="step"><strong>3.</strong> Conectar dispositivo</div>
            <div class="step"><strong>4.</strong> Escaneie o código acima</div>
        </div>
    </div>
    
    <script>
        QRCode.toCanvas(document.getElementById('qr'), '${currentQR}', {
            width: 300,
            margin: 2
        });
        
        setTimeout(() => location.reload(), 10000);
    </script>
</body>
</html>
        `);
    } else if (connectionStatus === 'Conectado') {
        res.send(`
<div style="text-align: center; padding: 50px; font-family: Arial;">
    <h1 style="color: green;">✅ WhatsApp Business Conectado!</h1>
    <p>Seu número foi conectado com sucesso.</p>
</div>
        `);
    } else {
        res.send(`
<div style="text-align: center; padding: 50px; font-family: Arial;">
    <h1>⏳ Gerando QR Code...</h1>
    <p>Aguarde alguns segundos e recarregue a página.</p>
    <script>setTimeout(() => location.reload(), 3000);</script>
</div>
        `);
    }
});

app.listen(3030, () => {
    console.log('Servidor QR rodando em http://localhost:3030');
});

client.initialize();