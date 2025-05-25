import { Telegraf } from 'telegraf';
import { log } from './server/vite';
import { configureEmail } from './server/email/simpleInvite';

/**
 * Este script corrige dois problemas principais:
 * 1. Atualiza os comandos disponíveis no Telegram, incluindo /configurar_email
 * 2. Adiciona o comando de configuração de email diretamente
 */
async function fixTelegramBot() {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
      return;
    }
    
    // Cria uma instância do bot
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    // Registra o comando configurar_email
    bot.command('configurar_email', async (ctx) => {
      try {
        // Verificar se é o admin do bot (você pode definir o ID do administrador)
        const adminId = process.env.ADMIN_TELEGRAM_ID || ctx.from.id.toString(); // Usa o ID do usuário atual como admin temporariamente
        const fromId = ctx.from.id.toString();
        
        if (fromId !== adminId) {
          await ctx.reply('⚠️ Este comando é restrito ao administrador do bot.');
          return;
        }
        
        // Extrair credenciais do comando
        // Formato esperado: /configurar_email email@exemplo.com senha
        const parts = ctx.message.text.split(' ');
        
        if (parts.length < 3) {
          await ctx.reply(
            '❌ *Formato inválido*\n\n' +
            'Use: /configurar_email email@exemplo.com senha\n\n' +
            'Este comando configura o email que será usado para enviar convites de calendário.\n' +
            'Para Gmail, use uma senha de aplicativo.',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const email = parts[1];
        const senha = parts.slice(2).join(' '); // Caso a senha tenha espaços
        
        // Configurar as credenciais
        const result = await configureEmail(email, senha);
        
        if (result.success) {
          await ctx.reply(
            '✅ *Configuração concluída*\n\n' +
            `Email configurado: ${email}\n\n` +
            'Agora o bot pode enviar convites de calendário por email.',
            { parse_mode: 'Markdown' }
          );
          
          // Apagar a mensagem que contém a senha para segurança
          try {
            await ctx.deleteMessage();
          } catch (deleteError) {
            // Ignora erro se não conseguir deletar a mensagem
          }
        } else {
          await ctx.reply(
            '❌ *Erro na configuração*\n\n' +
            `Não foi possível configurar o email: ${result.message}`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        log(`Erro ao configurar email remetente: ${error}`, 'telegram');
        await ctx.reply('Ocorreu um erro ao processar seu pedido. Por favor, tente novamente mais tarde.');
      }
    });
    
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
    
    // Inicializa o bot brevemente para registrar o comando
    await bot.launch();
    
    console.log('Comandos do Telegram atualizados com sucesso!');
    console.log('Comando /configurar_email registrado!');
    
    // Encerra o bot após alguns segundos
    setTimeout(() => {
      bot.stop('SIGINT');
      console.log('Bot parado após configuração.');
    }, 5000);
    
  } catch (error) {
    console.error('Erro ao corrigir o bot:', error);
  }
}

// Executa a função
fixTelegramBot();