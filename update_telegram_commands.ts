import { Telegraf } from 'telegraf';

async function updateBotCommands() {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
      return;
    }
    
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    // Define os comandos do bot
    const commands = [
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'help', description: 'Mostrar ajuda' },
      { command: 'ajuda', description: 'Exibir comandos disponíveis' },
      { command: 'email', description: 'Configurar seu e-mail para receber convites' },
      { command: 'configurar_email', description: 'Configurar e-mail remetente (admin)' },
      { command: 'apagar', description: 'Apagar um evento do calendário' },
      { command: 'eventos', description: 'Listar seus eventos futuros' },
      { command: 'semana', description: 'Mostrar eventos da semana atual' }
    ];
    
    // Registra os comandos no Telegram
    await bot.telegram.setMyCommands(commands);
    
    console.log('Comandos do Telegram atualizados com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar comandos:', error);
  }
}

// Executa a função
updateBotCommands();