import { Telegraf } from 'telegraf';
import { log } from './server/vite';
import { configureEmail } from './server/email/simpleInvite';
import { storage } from './server/storage';

// Verificar token do bot
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
}

// Cria uma instância do bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Adiciona comandos
async function setupBot() {
  try {
    // Comando configurar_email
    bot.command('configurar_email', async (ctx) => {
      try {
        // Verificar se é o admin do bot (considera quem chamou como admin)
        const fromId = ctx.from.id.toString();
        
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
    
    // Comando de ajuda
    bot.command('ajuda', async (ctx) => {
      await ctx.reply(
        `🤖 *Comandos do Assistente de Agenda*\n\n` +
        `• Envie mensagens descrevendo seus compromissos\n` +
        `• /email - Configurar seu e-mail para receber convites\n` +
        `• /configurar_email - Configurar email remetente\n` +
        `• /apagar - Apagar um evento do calendário\n` +
        `• /ajuda - Mostrar esta mensagem\n\n` +
        `Para adicionar um evento, simplesmente me diga o que você quer agendar, quando e onde.`,
        { parse_mode: 'Markdown' }
      );
    });
    
    // Define os comandos disponíveis
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'help', description: 'Mostrar ajuda' },
      { command: 'ajuda', description: 'Exibir comandos disponíveis' },
      { command: 'email', description: 'Configurar seu e-mail para receber convites' },
      { command: 'configurar_email', description: 'Configurar e-mail remetente' },
      { command: 'apagar', description: 'Apagar um evento do calendário' }
    ]);
    
    console.log('Comandos configurados, iniciando bot...');
    
    // Inicia o bot
    await bot.launch();
    console.log('Bot iniciado com sucesso!');
  } catch (error) {
    console.error('Erro ao configurar bot:', error);
  }
}

// Inicia a configuração
setupBot();