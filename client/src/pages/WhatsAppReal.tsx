import { useState, useEffect } from 'react';

export default function WhatsAppReal() {
  const [status, setStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('5511999999999');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/zapi/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const connectWhatsApp = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/zapi/connect', { method: 'POST' });
      const data = await response.json();
      
      if (data.success && data.qrCode) {
        setQrCode(data.qrCode);
      }
    } catch (error) {
      console.error('Erro ao conectar:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testPhone) return;
    
    try {
      const response = await fetch('/api/zapi/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          message: '🤖 WhatsApp conectado! Agora você pode enviar mensagens como "reunião amanhã às 14h" e eu criarei eventos automaticamente!'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Mensagem de teste enviada!');
      } else {
        alert('Erro ao enviar mensagem: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao enviar mensagem');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Conectar WhatsApp Real</h1>
      <p>Configure seu número do WhatsApp para receber mensagens e processar eventos automaticamente.</p>
      
      {/* Status da conexão */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>Status da Conexão</h3>
        {status ? (
          <div>
            <p><strong>Configurado:</strong> {status.configured ? 'Sim' : 'Não'}</p>
            <p><strong>Conectado:</strong> {status.connected ? 'Sim' : 'Não'}</p>
            <p><strong>Instância:</strong> {status.instanceId || 'N/A'}</p>
            <p><strong>Mensagens processadas:</strong> {status.messageCount}</p>
            {status.diagnosis && (
              <p><strong>Diagnóstico:</strong> {status.diagnosis}</p>
            )}
          </div>
        ) : (
          <p>Carregando status...</p>
        )}
        
        <button 
          onClick={checkStatus}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Atualizar Status
        </button>
      </div>

      {/* Conexão WhatsApp */}
      {!status?.connected && (
        <div style={{ 
          backgroundColor: '#fff3cd', 
          padding: '20px', 
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #ffeaa7'
        }}>
          <h3>Conectar WhatsApp</h3>
          <p>Para usar o WhatsApp, você precisa escanear o QR Code com seu celular:</p>
          
          <button 
            onClick={connectWhatsApp}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#25d366',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            {loading ? 'Gerando QR Code...' : 'Gerar QR Code'}
          </button>
          
          {qrCode && (
            <div style={{ marginTop: '20px' }}>
              <h4>Escaneie este QR Code:</h4>
              <img 
                src={qrCode} 
                alt="QR Code WhatsApp"
                style={{ border: '1px solid #ccc', borderRadius: '8px' }}
              />
              <p style={{ fontSize: '14px', color: '#666' }}>
                1. Abra o WhatsApp no seu celular<br/>
                2. Vá em Menu (3 pontos) &gt; WhatsApp Web<br/>
                3. Escaneie este QR Code
              </p>
            </div>
          )}
        </div>
      )}

      {/* Teste de mensagem */}
      {status?.connected && (
        <div style={{ 
          backgroundColor: '#d4edda', 
          padding: '20px', 
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #c3e6cb'
        }}>
          <h3>WhatsApp Conectado! ✅</h3>
          <p>Seu WhatsApp está funcionando. Teste enviando uma mensagem:</p>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Número com código do país (ex: 5511999999999)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              style={{
                flex: 1,
                padding: '10px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <button 
              onClick={sendTestMessage}
              style={{
                padding: '10px 20px',
                backgroundColor: '#25d366',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Enviar Teste
            </button>
          </div>
        </div>
      )}

      {/* Instruções de uso */}
      <div style={{ 
        backgroundColor: '#e7f3ff', 
        padding: '20px', 
        borderRadius: '8px',
        border: '1px solid #b3d9ff'
      }}>
        <h3>Como usar</h3>
        <p>Depois de conectar o WhatsApp, você ou qualquer pessoa pode enviar mensagens como:</p>
        <ul>
          <li>"Reunião com cliente amanhã às 14h"</li>
          <li>"Jantar com família sexta às 19h30"</li>
          <li>"Consulta médica terça às 10h"</li>
          <li>"Call de projeto quinta às 15h"</li>
        </ul>
        <p>O sistema processará automaticamente e responderá com links para adicionar no Google Calendar e Outlook!</p>
      </div>
    </div>
  );
}