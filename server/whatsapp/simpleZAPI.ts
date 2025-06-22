/**
 * Implementação simplificada do Z-API com melhor tratamento de erros
 */

import axios from 'axios';

interface ZAPICredentials {
  instanceId: string;
  token: string;
  phone: string;
}

let credentials: ZAPICredentials | null = null;

/**
 * Configura as credenciais do Z-API
 */
export function setupSimpleZAPI(instanceId: string, token: string, phone: string): boolean {
  try {
    if (!instanceId || !token || !phone) {
      console.error('❌ Credenciais incompletas');
      return false;
    }

    credentials = { instanceId, token, phone };
    console.log(`✅ Z-API configurado: ${instanceId} para ${phone}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao configurar Z-API:', error);
    return false;
  }
}

/**
 * Testa se as credenciais estão válidas
 */
export async function testZAPICredentials(): Promise<{ success: boolean, message: string }> {
  if (!credentials) {
    return { success: false, message: 'Credenciais não configuradas' };
  }

  try {
    const testUrl = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/status`;
    
    const response = await axios.get(testUrl, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      return { 
        success: true, 
        message: `Credenciais válidas. Status: ${response.data?.connected ? 'Conectado' : 'Desconectado'}` 
      };
    } else {
      return { 
        success: false, 
        message: `Credenciais inválidas. Status HTTP: ${response.status}` 
      };
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      return { 
        success: false, 
        message: 'Instance ID ou Token inválidos. Verifique no painel Z-API.' 
      };
    } else if (error.response?.status === 404) {
      return { 
        success: false, 
        message: 'Instância não encontrada. Verifique o Instance ID no painel Z-API.' 
      };
    } else {
      return { 
        success: false, 
        message: `Erro de conexão: ${error.message}` 
      };
    }
  }
}

/**
 * Gera QR Code com múltiplas tentativas
 */
export async function generateQRCode(): Promise<{ success: boolean, qrCode?: string, message: string }> {
  if (!credentials) {
    return { success: false, message: 'Configure as credenciais primeiro' };
  }

  const baseUrl = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}`;
  
  // Diferentes endpoints possíveis
  const endpoints = [
    '/qr-code',
    '/qrcode', 
    '/connect-qr',
    '/generate-qr'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Tentando: ${baseUrl}${endpoint}`);
      
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`📱 Resposta do endpoint ${endpoint}:`, JSON.stringify(response.data, null, 2));

      // Procura o QR Code em diferentes campos
      const qrCode = response.data?.qrcode || 
                    response.data?.qr_code || 
                    response.data?.value || 
                    response.data?.base64 ||
                    response.data?.image ||
                    response.data?.data;

      if (qrCode && qrCode.length > 50) { // QR Code válido deve ter pelo menos 50 caracteres
        return {
          success: true,
          qrCode: qrCode,
          message: `QR Code gerado via ${endpoint}`
        };
      }

    } catch (error: any) {
      console.log(`❌ Erro no endpoint ${endpoint}:`, error.response?.status, error.response?.data);
    }
  }

  // Se chegou aqui, nenhum endpoint funcionou
  return {
    success: false,
    message: 'Não foi possível gerar o QR Code. Verifique se a instância está ativa no painel Z-API e tente novamente.'
  };
}

/**
 * Verifica status da conexão
 */
export async function checkConnectionStatus(): Promise<{ connected: boolean, message: string }> {
  if (!credentials) {
    return { connected: false, message: 'Credenciais não configuradas' };
  }

  try {
    const response = await axios.get(
      `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/status`,
      { timeout: 8000 }
    );

    const connected = response.data?.connected === true;
    
    return {
      connected,
      message: connected ? 'WhatsApp conectado' : 'WhatsApp desconectado - escaneie o QR Code'
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Erro ao verificar status: ${error.response?.data?.message || error.message}`
    };
  }
}

/**
 * Envia mensagem via Z-API
 */
export async function sendMessage(phone: string, message: string): Promise<boolean> {
  if (!credentials) {
    console.error('❌ Credenciais não configuradas');
    return false;
  }

  try {
    const response = await axios.post(
      `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/send-text`,
      {
        phone: phone.replace(/\D/g, ''), // Remove caracteres não numéricos
        message: message
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.status === 200;
  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem:', error.response?.data || error.message);
    return false;
  }
}

export function getCredentials() {
  return credentials;
}