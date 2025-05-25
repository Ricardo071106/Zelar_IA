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
      { command: 'calendario', description: 'Configurar integração com Google Calendar' },
      { command: 'email', description: 'Atualizar seu e-mail' }
    ];
    
    // Registra os comandos no Telegram
    await bot.telegram.setMyCommands(commands);
    
    console.log('Comandos atualizados com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar comandos:', error);
  }
}

// Executa a função
updateBotCommands();