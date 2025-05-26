const { spawn } = require('child_process');

console.log('🤖 Iniciando bot Zelar...');

const bot = spawn('tsx', ['bot_standalone.ts'], {
  stdio: 'inherit',
  env: process.env
});

bot.on('close', (code) => {
  console.log(`Bot encerrado com código ${code}`);
});

bot.on('error', (err) => {
  console.error('Erro ao iniciar bot:', err);
});