import { Telegraf } from 'telegraf';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

// Configura conexão com o banco de dados
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN não está definido");
      process.exit(1);
    }
    
    // Cria uma nova instância do bot, independente da existente
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    // Adiciona um comando de teste simplificado
    bot.command('verificar', async (ctx) => {
      try {
        const telegramId = ctx.from.id.toString();
        console.log(`Comando verificar recebido de ${telegramId}`);
        
        // Consulta direta ao banco de dados
        const result = await db.execute(
          `SELECT * FROM users WHERE "telegramId" = $1`, 
          [telegramId]
        );
        
        if (!result.rows || result.rows.length === 0) {
          await ctx.reply('Usuário não encontrado. Por favor, use /start para iniciar o bot.');
          return;
        }
        
        const userId = result.rows[0].id;
        console.log(`Usuário encontrado com ID: ${userId}`);
        
        // Consulta direta por eventos
        const eventsResult = await db.execute(
          `SELECT * FROM events WHERE "userId" = $1`,
          [userId]
        );
        
        console.log(`Eventos encontrados: ${eventsResult.rows.length}`);
        
        if (!eventsResult.rows || eventsResult.rows.length === 0) {
          await ctx.reply('Você não tem eventos cadastrados.');
          return;
        }
        
        // Formata uma resposta simples
        let message = `Encontrei ${eventsResult.rows.length} eventos:\n\n`;
        
        for (const evento of eventsResult.rows) {
          message += `ID: ${evento.id} - ${evento.title}\n`;
          message += `Data: ${new Date(evento.startDate).toLocaleString('pt-BR')}\n\n`;
        }
        
        await ctx.reply(message);
        console.log('Resposta enviada com sucesso');
        
      } catch (error) {
        console.error(`Erro ao executar comando verificar: ${error}`);
        await ctx.reply(`Erro: ${error.message}`);
      }
    });
    
    // Inicia o bot em modo independente
    console.log('Iniciando bot de teste...');
    await bot.launch();
    console.log('Bot de teste iniciado com sucesso');
    
    // Configura limpeza ao encerrar
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
  } catch (error) {
    console.error(`Erro ao iniciar script: ${error}`);
  }
}

main();