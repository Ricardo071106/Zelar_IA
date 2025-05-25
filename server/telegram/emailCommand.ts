import { Telegraf } from 'telegraf';
import { log } from '../vite';
import { setupEmailCredentials } from '../email/emailService';

/**
 * Adiciona o comando para configurar o email remetente que enviará convites
 * 
 * @param bot Instância do bot do Telegram
 */
export function addEmailConfigCommand(bot: Telegraf) {
  // Comando para configurar o email remetente
  bot.command('configurar_email', async (ctx) => {
    try {
      // Verificar se é o admin do bot (você pode definir o ID do administrador)
      // Este comando só deve ser executado pelo administrador do bot
      const adminId = process.env.ADMIN_TELEGRAM_ID || '1234567890'; // Substitua pelo seu ID no Telegram
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
      const result = await setupEmailCredentials(email, senha);
      
      if (result.success) {
        await ctx.reply(
          '✅ *Configuração concluída*\n\n' +
          `Email configurado: ${email}\n\n` +
          'Agora o bot pode enviar convites de calendário por email.',
          { parse_mode: 'Markdown' }
        );
        
        // Apagar a mensagem que contém a senha para segurança
        await ctx.deleteMessage();
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
}