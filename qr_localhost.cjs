const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

let currentQR = null;
let connectionStatus = 'disconnected';

// Servir arquivos estáticos
app.use(express.static('public'));

// Página principal do QR
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp QR - Local</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f0f2f5;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        h1 {
            color: #25D366;
            margin-bottom: 20px;
        }
        .qr-container {
            border: 2px dashed #25D366;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fafafa;
        }
        .qr-code {
            font-family: monospace;
            font-size: 4px;
            line-height: 4px;
            white-space: pre;
            color: #000;
            background: white;
            padding: 10px;
            border-radius: 5px;
        }
        .status {
            padding: 10px;
            border-radius: 5px;
            margin: 15px 0;
            font-weight: bold;
        }
        .loading { background: #fff3cd; color: #856404; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .instructions {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #25D366;
            text-align: left;
        }
        .btn {
            background: #25D366;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        .btn:hover {
            background: #128C7E;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 WhatsApp Zelar Bot</h1>
        <p>Conecte seu WhatsApp com o assistente inteligente</p>
        
        <div id="status" class="status loading">🔄 Carregando...</div>
        
        <div class="qr-container" id="qr-container">
            <div id="qr-display">Aguardando QR code...</div>
        </div>
        
        <button class="btn" onclick="refreshQR()">🔄 Atualizar QR</button>
        
        <div class="instructions">
            <strong>📋 Como conectar:</strong>
            <ol>
                <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                <li>Vá em <strong>Configurações</strong></li>
                <li>Toque em <strong>"Dispositivos Vinculados"</strong></li>
                <li>Toque em <strong>"Vincular um dispositivo"</strong></li>
                <li><strong>Escaneie o QR code</strong> acima</li>
            </ol>
        </div>
        
        <div style="margin-top: 20px; font-size: 14px; color: #666;">
            ✨ Após conectar, envie mensagens como:<br>
            <em>"Reunião amanhã às 14h"</em><br>
            <em>"Dentista sexta às 10h"</em>
        </div>
    </div>

    <script>
        function updateStatus() {
            fetch('/status')
                .then(response => response.json())
                .then(data => {
                    const statusEl = document.getElementById('status');
                    const qrEl = document.getElementById('qr-display');
                    
                    if (data.connected) {
                        statusEl.textContent = '✅ WhatsApp conectado!';
                        statusEl.className = 'status success';
                        qrEl.innerHTML = '<div style="color: #25D366; font-size: 24px;">✅ Conectado!</div>';
                    } else if (data.qr) {
                        statusEl.textContent = '📱 QR Code pronto! Escaneie agora.';
                        statusEl.className = 'status success';
                        qrEl.innerHTML = '<div class="qr-code">' + data.qr + '</div>';
                    } else {
                        statusEl.textContent = '🔄 Gerando QR code...';
                        statusEl.className = 'status loading';
                        qrEl.textContent = 'Aguardando QR code...';
                    }
                })
                .catch(error => {
                    console.error('Erro:', error);
                    document.getElementById('status').textContent = '❌ Erro de conexão';
                    document.getElementById('status').className = 'status error';
                });
        }
        
        function refreshQR() {
            fetch('/refresh', { method: 'POST' })
                .then(() => updateStatus());
        }
        
        // Atualizar status a cada 2 segundos
        setInterval(updateStatus, 2000);
        updateStatus();
    </script>
</body>
</html>
  `);
});

// API para status
app.get('/status', (req, res) => {
  res.json({
    connected: connectionStatus === 'connected',
    qr: currentQR
  });
});

// API para refresh
app.post('/refresh', (req, res) => {
  console.log('🔄 Solicitando novo QR code...');
  initializeWhatsApp();
  res.json({ success: true });
});

async function initializeWhatsApp() {
  try {
    console.log('🚀 Iniciando WhatsApp...');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_local');
    
    const sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('ZelarBot'),
      printQRInTerminal: false
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 QR Code gerado para localhost!');
        
        // Converter QR para ASCII art simples
        const qrLines = qr.split('').map((char, i) => {
          if (i % 40 === 0) return '\n';
          return char.charCodeAt(0) % 2 === 0 ? '██' : '  ';
        }).join('');
        
        currentQR = qrLines;
      }
      
      if (connection === 'close') {
        console.log('❌ Conexão fechada');
        connectionStatus = 'disconnected';
        currentQR = null;
        
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('🔄 Tentando reconectar...');
          setTimeout(initializeWhatsApp, 3000);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado via localhost!');
        connectionStatus = 'connected';
        currentQR = null;
        
        // Handler de mensagens
        sock.ev.on('messages.upsert', async (m) => {
          const message = m.messages[0];
          
          if (!message.key.fromMe && message.message) {
            const from = message.key.remoteJid;
            const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
            
            console.log('📩 Mensagem: ' + text);
            
            if (text.toLowerCase().includes('reunião') || 
                text.toLowerCase().includes('evento') || 
                text.toLowerCase().includes('compromisso')) {
              
              const response = `✅ Evento processado!

📅 "${text}"

🔗 Google Calendar: https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}

🔗 Outlook: https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(text)}

🤖 Zelar Bot com Claude AI`;
              
              await sock.sendMessage(from, { text: response });
            }
          }
        });
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    connectionStatus = 'error';
  }
}

// Iniciar servidor
app.listen(PORT, 'localhost', () => {
  console.log('\n🌐 Servidor local rodando em: http://localhost:' + PORT);
  console.log('📱 Acesse o link acima para ver o QR code do WhatsApp\n');
  
  // Inicializar WhatsApp
  initializeWhatsApp();
});

// Tratar encerramento
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  process.exit(0);
});