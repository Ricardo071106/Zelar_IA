/**
 * ZAPI WhatsApp Simple Integration
 * Versão simplificada usando apenas autenticação via URL
 */

interface ZAPIConfig {
  instanceId: string;
  token: string;
  baseUrl: string;
}

export class ZAPISimple {
  private config: ZAPIConfig;

  constructor() {
    this.config = {
      instanceId: process.env.ZAPI_INSTANCE_ID || '',
      token: process.env.ZAPI_TOKEN || '',
      baseUrl: 'https://api.z-api.io/instances'
    };
  }

  isConfigured(): boolean {
    return !!(this.config.instanceId && this.config.token);
  }

  async getInstanceStatus(): Promise<{
    success: boolean;
    connected: boolean;
    data?: any;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        connected: false,
        error: 'Credenciais ZAPI não configuradas'
      };
    }

    try {
      const url = `${this.config.baseUrl}/${this.config.instanceId}/token/${this.config.token}/status`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          connected: data.connected || false,
          data
        };
      } else {
        return {
          success: false,
          connected: false,
          error: data.error || 'Erro ao verificar status'
        };
      }
    } catch (error) {
      return {
        success: false,
        connected: false,
        error: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`
      };
    }
  }

  async sendTextMessage(phone: string, message: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Credenciais ZAPI não configuradas'
      };
    }

    try {
      const url = `${this.config.baseUrl}/${this.config.instanceId}/token/${this.config.token}/send-text`;
      
      const cleanPhone = phone.replace(/\D/g, '');
      
      const payload = {
        phone: cleanPhone,
        message: message
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && !data.error) {
        return {
          success: true,
          messageId: data.messageId || data.id
        };
      } else {
        return {
          success: false,
          error: data.error || data.message || 'Erro ao enviar mensagem'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`
      };
    }
  }

  async connectInstance(): Promise<{
    success: boolean;
    qrCode?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Credenciais ZAPI não configuradas'
      };
    }

    try {
      const url = `${this.config.baseUrl}/${this.config.instanceId}/token/${this.config.token}/qr-code`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          qrCode: data.qrcode || data.qr_code
        };
      } else {
        return {
          success: false,
          error: data.error || 'Erro ao obter QR code'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`
      };
    }
  }

  async restartInstance(): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Credenciais ZAPI não configuradas'
      };
    }

    try {
      const url = `${this.config.baseUrl}/${this.config.instanceId}/token/${this.config.token}/restart`;
      
      const response = await fetch(url, { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        return {
          success: true
        };
      } else {
        return {
          success: false,
          error: data.error || 'Erro ao reiniciar instância'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`
      };
    }
  }

  generateAutoResponse(incomingMessage: string): string {
    const lowerMessage = incomingMessage.toLowerCase();
    
    if (lowerMessage.includes('ola') || lowerMessage.includes('oi') || lowerMessage.includes('olá')) {
      return '👋 Olá! Sou o Zelar, seu assistente de agendamento.\n\nPara criar compromissos, use nosso bot do Telegram: @ZelarBot\n\nComo posso ajudar?';
    }
    
    if (lowerMessage.includes('agendar') || lowerMessage.includes('compromisso') || lowerMessage.includes('reunião')) {
      return '📅 Para agendar compromissos, acesse nosso bot do Telegram: @ZelarBot\n\nLá você pode criar eventos usando linguagem natural:\n• "Reunião amanhã às 14h"\n• "Consulta médica sexta às 9h"\n• "Jantar sábado às 20h"';
    }
    
    if (lowerMessage.includes('telegram') || lowerMessage.includes('bot')) {
      return '🤖 Nosso bot do Telegram: @ZelarBot\n\nRecursos:\n✅ Entende português natural\n✅ Cria eventos automaticamente\n✅ Sincroniza com calendários\n✅ Envio por email\n\nExperimente agora!';
    }

    if (lowerMessage.includes('ajuda') || lowerMessage.includes('help')) {
      return '🆘 Como posso ajudar:\n\n📅 Agendamentos → Use @ZelarBot no Telegram\n⚡ Linguagem natural → "reunião amanhã 14h"\n📧 Convites automáticos por email\n🔗 Integração com calendários\n\nPrecisa de mais alguma coisa?';
    }
    
    return '😊 Obrigado pela mensagem!\n\nPara agendamentos inteligentes, use nosso bot: @ZelarBot\n\nEle entende português e cria seus compromissos automaticamente. Experimente!';
  }

  getAccountInfo(): {
    instanceId: string;
    configured: boolean;
  } {
    return {
      instanceId: this.config.instanceId,
      configured: this.isConfigured()
    };
  }
}

export const zapiSimple = new ZAPISimple();