import { useState, useEffect } from 'react';

export default function WhatsAppReal() {
  const [status, setStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [testPhone, setTestPhone] = useState('5511999999999');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setUpdatingStatus(true);
    try {
      console.log('Buscando status...');
      const response = await fetch('/api/zapi/status');
      const data = await response.json();
      console.log('Status recebido:', data);
      setStatus(data);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setUpdatingStatus(false);
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
      <h1>Ativar WhatsApp Automático</h1>
      <p>Configure seu número do WhatsApp para receber mensagens das pessoas e responder automaticamente com eventos de calendário.</p>
      
      <div style={{ 
        backgroundColor: '#e7f3ff', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #b3d9ff'
      }}>
        <h4>Como funciona:</h4>
        <ul style={{ margin: 0 }}>
          <li>Pessoas enviam: "Reunião amanhã às 14h" para seu WhatsApp</li>
          <li>Sistema responde automaticamente com links de calendário</li>
          <li>Mesma inteligência AI do Bot Telegram</li>
          <li>Funciona 24/7 sem você precisar fazer nada</li>
        </ul>
      </div>
      
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
            
            {status.timestamp && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                <strong>Última verificação:</strong> {new Date(status.timestamp).toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        ) : (
          <p>Carregando status...</p>
        )}
        
        <button 
          onClick={checkStatus}
          disabled={updatingStatus}
          style={{
            padding: '8px 16px',
            backgroundColor: updatingStatus ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: updatingStatus ? 'not-allowed' : 'pointer',
            marginTop: '10px'
          }}
        >
          {updatingStatus ? 'Atualizando...' : 'Atualizar Status'}
        </button>
      </div>

      {/* Problema com ZAPI */}
      {status && !status.connected && status.diagnosis?.includes('Token inválido') && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          padding: '20px', 
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <h3>⚠️ Instância ZAPI Inativa</h3>
          <p><strong>Problema:</strong> {status.diagnosis}</p>
          
          <div style={{ marginTop: '15px' }}>
            <h4>Como resolver:</h4>
            <ol>
              <li>Acesse o painel da ZAPI: <a href="https://developer.z-api.io" target="_blank" style={{ color: '#007bff' }}>https://developer.z-api.io</a></li>
              <li>Faça login na sua conta</li>
              <li>Verifique se sua instância <strong>{status.instanceId}</strong> está ativa</li>
              <li>Se estiver pausada, clique em "Ativar" ou "Start"</li>
              <li>Aguarde alguns minutos e clique em "Atualizar Status" aqui</li>
            </ol>
          </div>
          
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
            <strong>Instância ID:</strong> {status.instanceId}
          </div>
        </div>
      )}

      {/* Conexão WhatsApp */}
      {status?.configured && !status?.connected && !status.diagnosis?.includes('Token inválido') && (
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