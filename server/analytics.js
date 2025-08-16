const fs = require('fs');
const path = require('path');

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
          topEvents: {},
          topPrompts: {},
          hourlyUsage: {},
          dailyUsage: {}
        };
      }
    } catch (error) {
      console.error('❌ Erro ao carregar analytics:', error);
      this.logs = [];
      this.stats = {
        totalMessages: 0,
        uniqueUsers: 0,
        platforms: { whatsapp: 0, telegram: 0 },
        topEvents: {},
        topPrompts: {},
        hourlyUsage: {},
        dailyUsage: {}
      };
    }
  }

  logMessage(platform, userId, message, response, eventTitle = null) {
    const timestamp = new Date();
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: timestamp.toISOString(),
      platform,
      userId: this.anonymizeUserId(userId),
      message: message.substring(0, 200), // Limitar tamanho
      response: response ? 'success' : 'error',
      eventTitle,
      hour: timestamp.getHours(),
      day: timestamp.toDateString()
    };

    this.logs.push(logEntry);
    this.updateStats(logEntry);
    this.saveData();
    
    console.log(`📊 Analytics: ${platform} - ${this.anonymizeUserId(userId)} - "${message.substring(0, 50)}..."`);
  }

  anonymizeUserId(userId) {
    // Criar hash simples para anonimizar
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `user_${Math.abs(hash).toString(36)}`;
  }

  updateStats(logEntry) {
    this.stats.totalMessages++;
    
    // Contar por plataforma
    this.stats.platforms[logEntry.platform]++;
    
    // Contar por hora
    const hour = logEntry.hour;
    this.stats.hourlyUsage[hour] = (this.stats.hourlyUsage[hour] || 0) + 1;
    
    // Contar por dia
    const day = logEntry.day;
    this.stats.dailyUsage[day] = (this.stats.dailyUsage[day] || 0) + 1;
    
    // Contar eventos
    if (logEntry.eventTitle) {
      this.stats.topEvents[logEntry.eventTitle] = (this.stats.topEvents[logEntry.eventTitle] || 0) + 1;
    }
    
    // Contar prompts (primeiras palavras)
    const firstWords = logEntry.message.split(' ').slice(0, 3).join(' ').toLowerCase();
    this.stats.topPrompts[firstWords] = (this.stats.topPrompts[firstWords] || 0) + 1;
  }

  saveData() {
    try {
      // Manter apenas últimos 1000 logs para não crescer muito
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(-1000);
      }
      
      fs.writeFileSync(this.logFile, JSON.stringify(this.logs, null, 2));
      fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      console.error('❌ Erro ao salvar analytics:', error);
    }
  }

  getStats() {
    return {
      ...this.stats,
      uniqueUsers: this.getUniqueUsers(),
      recentActivity: this.logs.slice(-10),
      topEvents: this.getTopItems(this.stats.topEvents, 10),
      topPrompts: this.getTopItems(this.stats.topPrompts, 10),
      hourlyUsage: this.stats.hourlyUsage,
      dailyUsage: this.getLast7Days()
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

  getLast7Days() {
    const last7Days = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStr = date.toDateString();
      last7Days[dayStr] = this.stats.dailyUsage[dayStr] || 0;
    }
    return last7Days;
  }

  getDashboardData() {
    const stats = this.getStats();
    return {
      summary: {
        totalMessages: stats.totalMessages,
        uniqueUsers: stats.uniqueUsers,
        whatsappMessages: stats.platforms.whatsapp,
        telegramMessages: stats.platforms.telegram
      },
      topEvents: stats.topEvents,
      topPrompts: stats.topPrompts,
      hourlyUsage: stats.hourlyUsage,
      dailyUsage: stats.dailyUsage,
      recentActivity: stats.recentActivity
    };
  }
}

module.exports = new Analytics(); 