import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WhatsAppQR() {
  const [qrExists, setQrExists] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);

  const checkQRCode = async () => {
    try {
      const response = await fetch('/whatsapp-qr.png');
      setQrExists(response.ok);
    } catch (error) {
      setQrExists(false);
    }
  };

  const checkConnection = async () => {
    try {
      const response = await fetch('/whatsapp-connection.json');
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
        setConnectionInfo(data);
      }
    } catch (error) {
      setIsConnected(false);
    }
  };

  useEffect(() => {
    checkQRCode();
    checkConnection();
    
    const interval = setInterval(() => {
      checkConnection();
    }, 5000); // Verifica conexão a cada 5 segundos

    return () => clearInterval(interval);
  }, []);

  const refreshQR = () => {
    window.location.reload();
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-green-600 mb-4">📱 Conectar WhatsApp Business</h1>
        <p className="text-xl text-gray-600">Escaneie o QR code para conectar seu número</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>QR Code para Conexão</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {qrExists ? (
              <div className="space-y-4">
                <img 
                  src="/whatsapp-qr.png" 
                  alt="QR Code WhatsApp Business" 
                  className="mx-auto border rounded-lg shadow-lg max-w-sm w-full"
                />
                <div className="text-sm text-gray-600">
                  <p>Escaneie com WhatsApp Business</p>
                  <p>Configurações → Dispositivos conectados → Conectar dispositivo</p>
                </div>
                <Button onClick={refreshQR} variant="outline" className="w-full">
                  Gerar Novo QR Code
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-gray-500 py-8">
                  <p>QR Code não encontrado</p>
                  <p className="text-sm">Execute: node whatsapp-qr-generator.js</p>
                </div>
                <Button onClick={refreshQR} className="w-full">
                  Atualizar Página
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status da Conexão</CardTitle>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <Alert className="border-green-500 bg-green-50">
                <AlertDescription className="text-green-800">
                  <div className="space-y-2">
                    <div className="font-bold">✅ WhatsApp Business Conectado!</div>
                    <div>📞 Número: {connectionInfo?.phoneNumber}</div>
                    <div>🏢 Empresa: {connectionInfo?.businessName}</div>
                    <div className="text-xs">
                      Conectado em: {new Date(connectionInfo?.connectedAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-orange-500 bg-orange-50">
                <AlertDescription className="text-orange-800">
                  <div className="space-y-2">
                    <div className="font-bold">⏳ Aguardando Conexão</div>
                    <div>Escaneie o QR code com seu WhatsApp Business</div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-6 space-y-4">
              <div className="text-sm">
                <h4 className="font-bold mb-2">Como conectar:</h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  <li>Abra WhatsApp Business no celular</li>
                  <li>Vá em Configurações</li>
                  <li>Toque em "Dispositivos conectados"</li>
                  <li>Toque em "Conectar um dispositivo"</li>
                  <li>Escaneie o QR code acima</li>
                </ol>
              </div>

              {isConnected && (
                <div className="pt-4 border-t">
                  <h4 className="font-bold mb-2">Próximos passos:</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>✅ Configure seu número em /whatsapp-config</p>
                    <p>✅ Teste enviando: "Reunião amanhã às 14h"</p>
                    <p>✅ Clientes do site serão redirecionados para seu número</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Comandos do Terminal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Para gerar QR Code:</label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                node whatsapp-qr-generator.js
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Para rodar bot completo:</label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                node whatsapp-business-integration.js
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}