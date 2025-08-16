import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Analytics {
  constructor() {
    this.logFile = path.join(__dirname, 'analytics.json');
    this.statsFile = path.join(__dirname, 'stats.json');
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.logFile)) {
        this.logs = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
      } else {
        this.logs = [];
      }
      
      if (fs.existsSync(this.statsFile)) {
        this.stats = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
      } else {
        this.stats = {
          totalMessages: 0,
          uniqueUsers: 0,
          platforms: { whatsapp: 0, telegram: 0 },
          engagement: {
            dailyActiveUsers: {},
            weeklyActiveUsers: {},
            monthlyActiveUsers: {},
            retentionRate: {},
            sessionDuration: {}
          },
          performance: {
            responseTime: [],
            successRate: 0,
            errorRate: 0,
            uptime: 100
          },
          growth: {
            newUsers: {},
            userGrowth: {},
            messageGrowth: {}
          },
          usage: {
            hourlyDistribution: {},
            dailyDistribution: {},
            weeklyDistribution: {},
            monthlyDistribution: {}
          },
          categories: {
            eventTypes: {},
            messageLengths: {},
            interactionTypes: {}
          }
        };
      }
    } catch (error) {
      console.error('❌ Erro ao carregar analytics:', error);
      this.logs = [];
      this.stats = {
        totalMessages: 0,
        uniqueUsers: 0,
        platforms: { whatsapp: 0, telegram: 0 },
        engagement: {
          dailyActiveUsers: {},
          weeklyActiveUsers: {},
          monthlyActiveUsers: {},
          retentionRate: {},
          sessionDuration: {}
        },
        performance: {
          responseTime: [],
          successRate: 0,
          errorRate: 0,
          uptime: 100
        },
        growth: {
          newUsers: {},
          userGrowth: {},
          messageGrowth: {}
        },
        usage: {
          hourlyDistribution: {},
          dailyDistribution: {},
          weeklyDistribution: {},
          monthlyDistribution: {}
        },
        categories: {
          eventTypes: {},
          messageLengths: {},
          interactionTypes: {}
        }
      };
    }
  }

  logMessage(platform, userId, message, response, eventTitle = null) {
    const timestamp = new Date();
    const startTime = Date.now();
    
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: timestamp.toISOString(),
      platform,
      userId: this.anonymizeUserId(userId),
      messageLength: message.length,
      responseSuccess: !!response,
      eventCategory: this.categorizeEvent(message),
      interactionType: this.categorizeInteraction(message),
      hour: timestamp.getHours(),
      day: timestamp.getDate(),
      weekday: timestamp.getDay(),
      month: timestamp.getMonth() + 1,
      year: timestamp.getFullYear(),
      dateKey: timestamp.toDateString(),
      weekKey: this.getWeekKey(timestamp),
      monthKey: `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}`
    };

    this.logs.push(logEntry);
    this.updateStats(logEntry);
    this.saveData();
    
    console.log(`📊 Analytics: ${platform} - ${this.anonymizeUserId(userId)} - ${logEntry.eventCategory} - ${logEntry.interactionType}`);
  }

  anonymizeUserId(userId) {
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `user_${Math.abs(hash).toString(36)}`;
  }

  categorizeEvent(message) {
    const lowerText = message.toLowerCase();
    
    // Categorias mais abrangentes
    if (lowerText.includes('jantar') || lowerText.includes('almoço') || lowerText.includes('almoco') || lowerText.includes('café') || lowerText.includes('cafe')) {
      return 'Refeição';
    }
    if (lowerText.includes('reunião') || lowerText.includes('reuniao') || lowerText.includes('meeting') || lowerText.includes('call')) {
      return 'Trabalho';
    }
    if (lowerText.includes('consulta') || lowerText.includes('médico') || lowerText.includes('medico') || lowerText.includes('dentista') || lowerText.includes('psicólogo') || lowerText.includes('psicologo')) {
      return 'Saúde';
    }
    if (lowerText.includes('prova') || lowerText.includes('teste') || lowerText.includes('aula') || lowerText.includes('curso') || lowerText.includes('estudo')) {
      return 'Educação';
    }
    if (lowerText.includes('festa') || lowerText.includes('aniversário') || lowerText.includes('aniversario') || lowerText.includes('casamento') || lowerText.includes('encontro')) {
      return 'Social';
    }
    if (lowerText.includes('academia') || lowerText.includes('exercício') || lowerText.includes('exercicio') || lowerText.includes('esporte')) {
      return 'Fitness';
    }
    if (lowerText.includes('viagem') || lowerText.includes('passeio') || lowerText.includes('turismo')) {
      return 'Lazer';
    }
    
    return 'Outros';
  }

  categorizeInteraction(message) {
    const lowerText = message.toLowerCase();
    
    if (lowerText.includes('hoje') || lowerText.includes('agora')) {
      return 'Imediato';
    }
    if (lowerText.includes('amanhã') || lowerText.includes('amanha')) {
      return 'Próximo Dia';
    }
    if (lowerText.includes('semana') || lowerText.includes('próxima') || lowerText.includes('proxima')) {
      return 'Próxima Semana';
    }
    if (lowerText.includes('mês') || lowerText.includes('mes') || lowerText.includes('próximo mês') || lowerText.includes('proximo mes')) {
      return 'Próximo Mês';
    }
    
    return 'Sem Data';
  }

  getWeekKey(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil(days / 7);
    return `${date.getFullYear()}-W${weekNumber}`;
  }

  updateStats(logEntry) {
    this.stats.totalMessages++;
    
    // Plataforma
    this.stats.platforms[logEntry.platform]++;
    
    // Distribuição temporal
    this.stats.usage.hourlyDistribution[logEntry.hour] = (this.stats.usage.hourlyDistribution[logEntry.hour] || 0) + 1;
    this.stats.usage.dailyDistribution[logEntry.dateKey] = (this.stats.usage.dailyDistribution[logEntry.dateKey] || 0) + 1;
    this.stats.usage.weeklyDistribution[logEntry.weekKey] = (this.stats.usage.weeklyDistribution[logEntry.weekKey] || 0) + 1;
    this.stats.usage.monthlyDistribution[logEntry.monthKey] = (this.stats.usage.monthlyDistribution[logEntry.monthKey] || 0) + 1;
    
    // Categorias
    this.stats.categories.eventTypes[logEntry.eventCategory] = (this.stats.categories.eventTypes[logEntry.eventCategory] || 0) + 1;
    this.stats.categories.interactionTypes[logEntry.interactionType] = (this.stats.categories.interactionTypes[logEntry.interactionType] || 0) + 1;
    
    // Comprimento da mensagem
    const lengthCategory = this.categorizeMessageLength(logEntry.messageLength);
    this.stats.categories.messageLengths[lengthCategory] = (this.stats.categories.messageLengths[lengthCategory] || 0) + 1;
    
    // Usuários ativos
    this.updateActiveUsers(logEntry);
    
    // Performance
    this.updatePerformance(logEntry);
  }

  categorizeMessageLength(length) {
    if (length <= 20) return 'Curta (≤20)';
    if (length <= 50) return 'Média (21-50)';
    if (length <= 100) return 'Longa (51-100)';
    return 'Muito Longa (>100)';
  }

  updateActiveUsers(logEntry) {
    const today = new Date().toDateString();
    const thisWeek = logEntry.weekKey;
    const thisMonth = logEntry.monthKey;
    
    // Daily Active Users
    if (!this.stats.engagement.dailyActiveUsers[today]) {
      this.stats.engagement.dailyActiveUsers[today] = new Set();
    }
    this.stats.engagement.dailyActiveUsers[today].add(logEntry.userId);
    
    // Weekly Active Users
    if (!this.stats.engagement.weeklyActiveUsers[thisWeek]) {
      this.stats.engagement.weeklyActiveUsers[thisWeek] = new Set();
    }
    this.stats.engagement.weeklyActiveUsers[thisWeek].add(logEntry.userId);
    
    // Monthly Active Users
    if (!this.stats.engagement.monthlyActiveUsers[thisMonth]) {
      this.stats.engagement.monthlyActiveUsers[thisMonth] = new Set();
    }
    this.stats.engagement.monthlyActiveUsers[thisMonth].add(logEntry.userId);
  }

  updatePerformance(logEntry) {
    // Success/Error Rate
    if (logEntry.responseSuccess) {
      this.stats.performance.successRate = (this.stats.performance.successRate * (this.stats.totalMessages - 1) + 1) / this.stats.totalMessages;
    } else {
      this.stats.performance.errorRate = (this.stats.performance.errorRate * (this.stats.totalMessages - 1) + 1) / this.stats.totalMessages;
    }
  }

  saveData() {
    try {
      // Manter apenas últimos 1000 logs
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(-1000);
      }
      
      // Converter Sets para arrays para JSON
      const statsToSave = JSON.parse(JSON.stringify(this.stats));
      
      // Converter Sets para contadores
      Object.keys(statsToSave.engagement.dailyActiveUsers).forEach(date => {
        statsToSave.engagement.dailyActiveUsers[date] = this.stats.engagement.dailyActiveUsers[date].size;
      });
      
      Object.keys(statsToSave.engagement.weeklyActiveUsers).forEach(week => {
        statsToSave.engagement.weeklyActiveUsers[week] = this.stats.engagement.weeklyActiveUsers[week].size;
      });
      
      Object.keys(statsToSave.engagement.monthlyActiveUsers).forEach(month => {
        statsToSave.engagement.monthlyActiveUsers[month] = this.stats.engagement.monthlyActiveUsers[month].size;
      });
      
      fs.writeFileSync(this.logFile, JSON.stringify(this.logs, null, 2));
      fs.writeFileSync(this.statsFile, JSON.stringify(statsToSave, null, 2));
    } catch (error) {
      console.error('❌ Erro ao salvar analytics:', error);
    }
  }

  getStats() {
    const uniqueUsers = this.getUniqueUsers();
    const recentActivity = this.logs.slice(-10);
    
    return {
      summary: {
        totalMessages: this.stats.totalMessages,
        uniqueUsers,
        whatsappMessages: this.stats.platforms.whatsapp,
        telegramMessages: this.stats.platforms.telegram
      },
      engagement: {
        dailyActiveUsers: this.getLast7Days(this.stats.engagement.dailyActiveUsers),
        weeklyActiveUsers: this.getLast4Weeks(this.stats.engagement.weeklyActiveUsers),
        monthlyActiveUsers: this.getLast6Months(this.stats.engagement.monthlyActiveUsers)
      },
      performance: {
        successRate: Math.round(this.stats.performance.successRate * 100),
        errorRate: Math.round(this.stats.performance.errorRate * 100),
        uptime: this.stats.performance.uptime
      },
      usage: {
        hourlyDistribution: this.stats.usage.hourlyDistribution,
        dailyDistribution: this.getLast7Days(this.stats.usage.dailyDistribution),
        weeklyDistribution: this.getLast4Weeks(this.stats.usage.weeklyDistribution)
      },
      categories: {
        eventTypes: this.getTopItems(this.stats.categories.eventTypes, 10),
        interactionTypes: this.getTopItems(this.stats.categories.interactionTypes, 10),
        messageLengths: this.getTopItems(this.stats.categories.messageLengths, 10)
      },
      recentActivity
    };
  }

  getUniqueUsers() {
    const users = new Set(this.logs.map(log => log.userId));
    return users.size;
  }

  getTopItems(items, limit) {
    return Object.entries(items)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([item, count]) => ({ item, count }));
  }

  getLast7Days(data) {
    const last7Days = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStr = date.toDateString();
      last7Days[dayStr] = data[dayStr] || 0;
    }
    return last7Days;
  }

  getLast4Weeks(data) {
    const last4Weeks = {};
    for (let i = 3; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7));
      const weekKey = this.getWeekKey(date);
      last4Weeks[weekKey] = data[weekKey] || 0;
    }
    return last4Weeks;
  }

  getLast6Months(data) {
    const last6Months = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      last6Months[monthKey] = data[monthKey] || 0;
    }
    return last6Months;
  }

  getDashboardData() {
    const stats = this.getStats();
    return {
      summary: stats.summary,
      engagement: stats.engagement,
      performance: stats.performance,
      usage: stats.usage,
      categories: stats.categories,
      recentActivity: stats.recentActivity
    };
  }
}

export default new Analytics(); 