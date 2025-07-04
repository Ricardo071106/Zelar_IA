/**
 * WhatsApp Business API Integration
 * Integração oficial com WhatsApp Business usando API oficial
 */

interface WhatsAppBusinessConfig {
  phoneNumber: string;
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
}

interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
  };
}

export class WhatsAppBusinessAPI {
  private config: WhatsAppBusinessConfig | null = null;
  private baseURL = 'https://graph.facebook.com/v17.0';

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    // Carregar configurações do ambiente ou banco de dados
    this.config = {
      phoneNumber: process.env.WHATSAPP_PHONE_NUMBER || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'zelar_webhook_token'
    };
  }

  /**
   * Configura as credenciais do WhatsApp Business
   */
  public setCredentials(config: Partial<WhatsAppBusinessConfig>) {
    this.config = {
      ...this.config!,
      ...config
    };
  }

  /**
   * Verifica se a configuração está completa
   */
  public isConfigured(): boolean {
    return !!(
      this.config?.phoneNumber &&
      this.config?.accessToken &&
      this.config?.phoneNumberId
    );
  }

  /**
   * Envia uma mensagem de texto
   */
  public async sendTextMessage(to: string, message: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'WhatsApp Business API não configurada'
      };
    }

    try {
      const url = `${this.baseURL}/${this.config!.phoneNumberId}/messages`;
      
      const payload: WhatsAppMessage = {
        to: to.replace(/\D/g, ''), // Remove caracteres não numéricos
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config!.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          messageId: data.messages[0]?.id
        };
      } else {
        return {
          success: false,
          error: data.error?.message || 'Erro ao enviar mensagem'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`
      };
    }
  }

  /**
   * Verifica o webhook do WhatsApp
   */
  public verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config?.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Processa mensagens recebidas do webhook
   */
  public processWebhookMessage(body: any): {
    from: string;
    message: string;
    timestamp: string;
  } | null {
    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];

      if (message) {
        return {
          from: message.from,
          message: message.text?.body || message.type,
          timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString()
        };
      }
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
    }
    return null;
  }

  /**
   * Obtém informações sobre o número de telefone
   */
  public async getPhoneNumberInfo(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'WhatsApp Business API não configurada'
      };
    }

    try {
      const url = `${this.baseURL}/${this.config!.phoneNumberId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config!.accessToken}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          data
        };
      } else {
        return {
          success: false,
          error: data.error?.message || 'Erro ao obter informações'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`
      };
    }
  }

  /**
   * Resposta automática para mensagens recebidas
   */
  public generateAutoResponse(incomingMessage: string): string {
    const lowerMessage = incomingMessage.toLowerCase();
    
    if (lowerMessage.includes('ola') || lowerMessage.includes('oi')) {
      return 'Olá! 👋 Sou o Zelar, seu assistente de agendamento.\n\nPara agendar compromissos, use nosso bot do Telegram: @ZelarBot\n\nPosso te ajudar com alguma dúvida?';
    }
    
    if (lowerMessage.includes('agendar') || lowerMessage.includes('compromisso')) {
      return 'Para agendar compromissos, acesse nosso bot do Telegram: @ZelarBot\n\nLá você pode criar eventos usando linguagem natural, como:\n"Reunião amanhã às 14h"\n"Consulta médica sexta-feira às 9h"';
    }
    
    if (lowerMessage.includes('telegram') || lowerMessage.includes('bot')) {
      return 'Nosso bot do Telegram está disponível em: @ZelarBot\n\nEle entende linguagem natural em português e cria eventos automaticamente no seu calendário!';
    }
    
    return 'Obrigado pela mensagem! 😊\n\nPara agendamentos, use nosso bot do Telegram: @ZelarBot\n\nSe precisar de ajuda, estou aqui!';
  }
}

export const whatsappBusiness = new WhatsAppBusinessAPI();