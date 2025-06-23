// Script para iniciar o WhatsApp bot como um processo separado
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando WhatsApp Bot Zelar...');

const whatsappBot = spawn('node', ['whatsapp-bot.js'], {
    stdio: 'inherit',
    cwd: process.cwd()
});

whatsappBot.on('error', (error) => {
    console.error('❌ Erro ao iniciar WhatsApp bot:', error);
});

whatsappBot.on('close', (code) => {
    console.log(`📴 WhatsApp bot encerrado com código: ${code}`);
    if (code !== 0) {
        console.log('🔄 Tentando reiniciar em 5 segundos...');
        setTimeout(() => {
            console.log('🚀 Reiniciando WhatsApp Bot...');
            spawn('node', ['start-whatsapp.js'], {
                stdio: 'inherit',
                detached: true
            });
        }, 5000);
    }
});

// Tratar sinais para encerramento limpo
process.on('SIGINT', () => {
    console.log('🛑 Encerrando WhatsApp bot...');
    whatsappBot.kill('SIGTERM');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Encerrando WhatsApp bot...');
    whatsappBot.kill('SIGTERM');
    process.exit(0);
});