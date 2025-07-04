import { useState } from 'react';

export default function WhatsAppSimple() {
  const [message, setMessage] = useState('Reunião com cliente amanhã às 14h');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testMessage = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: '5511999999999',
          message: message 
        })
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, response: 'Erro de conexão' });
    } finally {
      setLoading(false);
    }
  };

  const showSampleResult = () => {
    setResult({
      success: true,
      response: "✅ Evento criado com sucesso!\n\n📅 *Reunião com cliente*\n🕐 5 de julho de 2025 às 14:00 BRT",
      event: {
        title: "Reunião com cliente",
        displayDate: "5 de julho de 2025 às 14:00 BRT",
        calendarLinks: {
          google: "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Reunião%20com%20cliente&dates=20250705T170000Z/20250705T180000Z",
          outlook: "https://outlook.live.com/calendar/0/deeplink/compose?subject=Reunião%20com%20cliente&startdt=2025-07-05T17:00:00.000Z&enddt=2025-07-05T18:00:00.000Z"
        }
      }
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>WhatsApp AI - Teste Simples</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '10px', 
            marginBottom: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
        
        <button 
          onClick={testMessage}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          {loading ? 'Processando...' : 'Testar IA'}
        </button>
        
        <button 
          onClick={showSampleResult}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Exemplo Visual
        </button>
      </div>

      {result && (
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3>Resultado:</h3>
          <p><strong>Status:</strong> {result.success ? 'Sucesso' : 'Erro'}</p>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '15px', 
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
              {result.response}
            </pre>
          </div>

          {result.success && result.event && (
            <div style={{ 
              backgroundColor: '#d4edda', 
              padding: '15px', 
              borderRadius: '4px',
              border: '1px solid #c3e6cb'
            }}>
              <h4 style={{ color: '#155724', marginTop: 0 }}>Evento Criado:</h4>
              <p style={{ color: '#155724' }}>
                <strong>{result.event.title}</strong><br />
                {result.event.displayDate}
              </p>
              
              <div style={{ marginTop: '15px' }}>
                <p style={{ color: '#155724', fontWeight: 'bold' }}>Botões de Calendário:</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => window.open(result.event.calendarLinks.google, '_blank')}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: '#4285f4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    📅 Google Calendar
                  </button>
                  <button
                    onClick={() => window.open(result.event.calendarLinks.outlook, '_blank')}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: '#ff6900',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    📆 Outlook
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}