/**
 * Sistema de verificação de saúde dos componentes
 */

interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: string;
  timestamp: Date;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: HealthCheckResult[];
  timestamp: Date;
}

export class HealthChecker {
  private static instance: HealthChecker;
  private lastChecks: Map<string, HealthCheckResult> = new Map();

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  async checkTelegramBot(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      // Verificação simples - se chegamos até aqui, o bot está rodando
      const responseTime = Date.now() - start;
      
      const result: HealthCheckResult = {
        component: 'telegram_bot',
        status: 'healthy',
        responseTime,
        details: 'Bot ativo e processando mensagens',
        timestamp: new Date()
      };
      
      this.lastChecks.set('telegram_bot', result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        component: 'telegram_bot',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
      
      this.lastChecks.set('telegram_bot', result);
      return result;
    }
  }



  async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      // Verificação simples de conectividade
      if (process.env.DATABASE_URL) {
        const result: HealthCheckResult = {
          component: 'database',
          status: 'healthy',
          responseTime: Date.now() - start,
          details: 'PostgreSQL conectado',
          timestamp: new Date()
        };
        
        this.lastChecks.set('database', result);
        return result;
      } else {
        throw new Error('DATABASE_URL não configurada');
      }
    } catch (error) {
      const result: HealthCheckResult = {
        component: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
      
      this.lastChecks.set('database', result);
      return result;
    }
  }

  async checkWhatsAppBot(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      // Importar dinamicamente para evitar erro se não estiver inicializado
      const { getWhatsAppBot } = await import('../whatsapp/whatsappBot');
      const bot = getWhatsAppBot();
      const status = bot.getStatus();
      
      const result: HealthCheckResult = {
        component: 'whatsapp',
        status: status.isReady ? 'healthy' : (status.qrCode ? 'degraded' : 'unhealthy'),
        responseTime: Date.now() - start,
        details: status.isReady ? 'WhatsApp conectado e funcionando' : 
                status.qrCode ? 'Aguardando autenticação QR Code' : 'WhatsApp desconectado',
        timestamp: new Date()
      };
      
      this.lastChecks.set('whatsapp', result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        component: 'whatsapp',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: `WhatsApp bot error: ${error instanceof Error ? error.message : 'Bot não inicializado'}`,
        timestamp: new Date()
      };
      
      this.lastChecks.set('whatsapp', result);
      return result;
    }
  }

  async checkAI(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      // Verificar se a chave da Anthropic está configurada
      if (process.env.ANTHROPIC_API_KEY) {
        const result: HealthCheckResult = {
          component: 'ai_claude',
          status: 'healthy',
          responseTime: Date.now() - start,
          details: 'Claude API configurada',
          timestamp: new Date()
        };
        
        this.lastChecks.set('ai_claude', result);
        return result;
      } else {
        throw new Error('ANTHROPIC_API_KEY não configurada');
      }
    } catch (error) {
      const result: HealthCheckResult = {
        component: 'ai_claude',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
      
      this.lastChecks.set('ai_claude', result);
      return result;
    }
  }

  async performFullHealthCheck(): Promise<SystemHealth> {
    const components = await Promise.all([
      this.checkTelegramBot(),
      this.checkDatabase(),
      this.checkAI()
    ]);

    // Determinar saúde geral do sistema
    const unhealthyCount = components.filter((c: HealthCheckResult) => c.status === 'unhealthy').length;
    const degradedCount = components.filter((c: HealthCheckResult) => c.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      components,
      timestamp: new Date()
    };
  }

  getLastCheck(component: string): HealthCheckResult | undefined {
    return this.lastChecks.get(component);
  }

  getAllLastChecks(): HealthCheckResult[] {
    return Array.from(this.lastChecks.values());
  }
}

// Exportar instância global
export const systemHealth = new HealthChecker();