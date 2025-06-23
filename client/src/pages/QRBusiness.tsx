import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function QRBusiness() {
  const [status, setStatus] = useState('Carregando...');
  const [qrCode, setQrCode] = useState('');
  const [businessInfo, setBusinessInfo] = useState<any>(null);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp-business/status');
      const data = await response.json();
      
      if (data.status === 'Conectado') {
        setStatus('Conectado');
        setQrCode('');
        setBusinessInfo(data.clientInfo);
      } else if (data.qrCode) {
        setStatus('Aguardando QR Code');
        setQrCode(data.qrCode);
      } else {
        setStatus('Gerando QR Code...');
        setQrCode('');
      }
    } catch (error) {
      setStatus('Bot não está rodando');
      setQrCode('');
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">📱 WhatsApp Business</h1>
        <p className="text-xl text-gray-600">Conecte sua conta empresarial ao sistema Zelar</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Status da Conexão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`p-4 rounded-lg text-center font-bold text-lg ${
            status === 'Conectado' ? 'bg-green-100 text-green-800' :
            status === 'Aguardando QR Code' ? 'bg-yellow-100 text-yellow-800' :
            status === 'Bot não está rodando' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {status === 'Conectado' && '✅ WhatsApp Business Conectado!'}
            {status === 'Aguardando QR Code' && '📱 Escaneie o QR Code abaixo'}
            {status === 'Bot não está rodando' && '❌ Bot não está rodando'}
            {status === 'Gerando QR Code...' && '⏳ Gerando QR Code...'}
            {status === 'Carregando...' && '🔄 Carregando...'}
          </div>
          
          {businessInfo && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-bold text-blue-800">Informações da Empresa:</h3>
              <p>🏢 Nome: {businessInfo.pushname || 'Não informado'}</p>
              <p>📞 Número: {businessInfo.number || 'Não informado'}</p>
              <p>✅ Conta Business: {businessInfo.isBusiness ? 'Sim' : 'Não'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {qrCode && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>QR Code para Conexão</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertDescription>
                Escaneie este código com seu WhatsApp Business
              </AlertDescription>
            </Alert>
            <div className="bg-white p-6 rounded-lg border-4 border-blue-500 text-center">
              <pre className="text-xs font-mono leading-none overflow-x-auto bg-gray-100 p-4 rounded">
                {qrCode}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Como Conectar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start p-4 bg-blue-50 rounded-lg">
              <div className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">1</div>
              <div>
                <h3 className="font-bold">Abra WhatsApp Business</h3>
                <p className="text-gray-600">Use o aplicativo WhatsApp Business, não o WhatsApp comum</p>
              </div>
            </div>
            
            <div className="flex items-start p-4 bg-blue-50 rounded-lg">
              <div className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">2</div>
              <div>
                <h3 className="font-bold">Menu → Dispositivos conectados</h3>
                <p className="text-gray-600">Toque nos 3 pontos e acesse "Dispositivos conectados"</p>
              </div>
            </div>
            
            <div className="flex items-start p-4 bg-blue-50 rounded-lg">
              <div className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">3</div>
              <div>
                <h3 className="font-bold">Conectar dispositivo</h3>
                <p className="text-gray-600">Toque em "Conectar dispositivo" ou "Vincular dispositivo"</p>
              </div>
            </div>
            
            <div className="flex items-start p-4 bg-blue-50 rounded-lg">
              <div className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">4</div>
              <div>
                <h3 className="font-bold">Escanear QR Code</h3>
                <p className="text-gray-600">Aponte a câmera para o código que aparece acima</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center space-x-4">
        <Button onClick={checkStatus} className="bg-blue-500 hover:bg-blue-600">
          Atualizar Status
        </Button>
        <Button 
          onClick={() => {
            setStatus('Iniciando bot...');
            setTimeout(checkStatus, 3000);
          }}
          variant="outline"
        >
          Iniciar Bot
        </Button>
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-bold mb-2">Informações Técnicas:</h3>
        <p><strong>Porta WhatsApp Business:</strong> 3001</p>
        <p><strong>API Status:</strong> /api/whatsapp-business/status</p>
        <p><strong>Sessão:</strong> Salva automaticamente após primeira conexão</p>
      </div>
    </div>
  );
}