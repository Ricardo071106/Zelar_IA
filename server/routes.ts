import type { Express } from "express";
import { createServer, type Server } from "http";

let whatsappStatus = {
  status: 'Desconectado',
  timestamp: new Date().toISOString(),
  qrCode: null
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Rota básica de saúde da aplicação
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // WhatsApp status endpoint
  app.get("/api/whatsapp/status", (req, res) => {
    res.json(whatsappStatus);
  });

  // WhatsApp personal send message endpoint
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { number, message } = req.body;
      
      if (!number || !message) {
        return res.status(400).json({
          success: false,
          error: "Número e mensagem são obrigatórios"
        });
      }

      // Forward to WhatsApp personal bot running on port 3000
      const response = await fetch('http://localhost:3000/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, message })
      });

      const result = await response.json();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Erro ao conectar com WhatsApp pessoal"
      });
    }
  });

  // WhatsApp Business status endpoint
  app.get("/api/whatsapp-business/status", async (req, res) => {
    try {
      const response = await fetch('http://localhost:3001/status');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.json({
        status: 'Desconectado',
        timestamp: new Date().toISOString(),
        qrCode: null,
        business: true
      });
    }
  });

  // WhatsApp Business send message endpoint
  app.post("/api/whatsapp-business/send", async (req, res) => {
    try {
      const { number, message } = req.body;
      
      if (!number || !message) {
        return res.status(400).json({
          success: false,
          error: "Número e mensagem são obrigatórios"
        });
      }

      // Forward to WhatsApp Business bot running on port 3001
      const response = await fetch('http://localhost:3001/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, message })
      });

      const result = await response.json();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Erro ao conectar com WhatsApp Business"
      });
    }
  });

  // WhatsApp Business info endpoint
  app.get("/api/whatsapp-business/info", async (req, res) => {
    try {
      const response = await fetch('http://localhost:3001/business-info');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Erro ao obter informações Business"
      });
    }
  });

  // Bot dashboard status
  app.get("/api/bots/status", (req, res) => {
    res.json({
      telegram: {
        status: 'conectado',
        lastUpdate: new Date().toISOString()
      },
      whatsapp: whatsappStatus
    });
  });

  // QR Code page for WhatsApp Business
  app.get("/qr-business", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Code WhatsApp Business</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            min-height: 100vh;
            color: white;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            color: #333;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        .header {
            margin-bottom: 30px;
        }
        .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 2.2rem;
        }
        .status {
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            font-weight: bold;
            font-size: 1.1rem;
        }
        .waiting {
            background: #fff3cd;
            color: #856404;
            border: 2px solid #ffeaa7;
        }
        .connected {
            background: #d4edda;
            color: #155724;
            border: 2px solid #c3e6cb;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            border: 2px solid #f5c6cb;
        }
        .qr-section {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 15px;
            margin: 20px 0;
            border: 3px solid #007bff;
        }
        .qr-code {
            font-family: monospace;
            font-size: 8px;
            line-height: 1;
            background: white;
            padding: 20px;
            border-radius: 10px;
            overflow-x: auto;
            white-space: pre;
            border: 1px solid #ddd;
        }
        .steps {
            text-align: left;
            background: #f8f9fa;
            padding: 25px;
            border-radius: 15px;
            margin: 20px 0;
        }
        .step {
            display: flex;
            align-items: center;
            margin: 15px 0;
            padding: 15px;
            background: white;
            border-radius: 10px;
            border-left: 4px solid #007bff;
        }
        .step-number {
            background: #007bff;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
        }
        .btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin: 10px;
            transition: background 0.3s;
        }
        .btn:hover {
            background: #0056b3;
        }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 WhatsApp Business</h1>
            <p>Conecte sua conta empresarial ao sistema Zelar</p>
        </div>

        <div id="status" class="status waiting">
            <div class="loading"></div>
            Verificando conexão...
        </div>

        <div id="qr-section" class="qr-section" style="display: none;">
            <h2>Escaneie com seu WhatsApp Business</h2>
            <div id="qr-display" class="qr-code">Carregando QR Code...</div>
        </div>

        <div class="steps">
            <h2>Como conectar:</h2>
            
            <div class="step">
                <div class="step-number">1</div>
                <div>
                    <strong>Abra WhatsApp Business</strong><br>
                    Use o app WhatsApp Business, não o WhatsApp comum
                </div>
            </div>

            <div class="step">
                <div class="step-number">2</div>
                <div>
                    <strong>Menu → Dispositivos conectados</strong><br>
                    Toque nos 3 pontos e acesse dispositivos conectados
                </div>
            </div>

            <div class="step">
                <div class="step-number">3</div>
                <div>
                    <strong>Conectar dispositivo</strong><br>
                    Toque em "Conectar dispositivo" ou "Vincular"
                </div>
            </div>

            <div class="step">
                <div class="step-number">4</div>
                <div>
                    <strong>Escanear QR Code</strong><br>
                    Aponte a câmera para o código que aparecerá acima
                </div>
            </div>
        </div>

        <button class="btn" onclick="checkStatus()">Atualizar Status</button>
        <button class="btn" onclick="startBot()">Iniciar Bot</button>
    </div>

    <script>
        async function checkStatus() {
            try {
                const response = await fetch('/api/whatsapp-business/status');
                const data = await response.json();
                
                const statusDiv = document.getElementById('status');
                const qrSection = document.getElementById('qr-section');
                const qrDisplay = document.getElementById('qr-display');

                if (data.status === 'Conectado') {
                    statusDiv.className = 'status connected';
                    statusDiv.innerHTML = '✅ WhatsApp Business conectado com sucesso!';
                    qrSection.style.display = 'none';
                    
                    if (data.clientInfo) {
                        statusDiv.innerHTML += '<br>🏢 ' + (data.clientInfo.pushname || 'Empresa conectada');
                    }
                    
                } else if (data.qrCode) {
                    statusDiv.className = 'status waiting';
                    statusDiv.innerHTML = '📱 Escaneie o QR Code abaixo com WhatsApp Business';
                    qrSection.style.display = 'block';
                    qrDisplay.textContent = data.qrCode;
                    
                } else {
                    statusDiv.className = 'status waiting';
                    statusDiv.innerHTML = '<div class="loading"></div> Gerando QR Code...';
                    qrSection.style.display = 'none';
                }
                
            } catch (error) {
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'status error';
                statusDiv.innerHTML = '❌ Bot não está rodando<br><small>Clique em "Iniciar Bot" abaixo</small>';
            }
        }

        async function startBot() {
            const statusDiv = document.getElementById('status');
            statusDiv.className = 'status waiting';
            statusDiv.innerHTML = '<div class="loading"></div> Iniciando WhatsApp Business Bot...';
            
            // Aguardar e verificar status
            setTimeout(checkStatus, 3000);
        }

        // Verificar status automaticamente
        checkStatus();
        setInterval(checkStatus, 5000);
    </script>
</body>
</html>
    `);
  });

  const server = createServer(app);
  return server;
}