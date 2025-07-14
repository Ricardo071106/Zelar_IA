#!/bin/bash

echo "🔄 Reiniciando TelegramScheduler..."

# Parar todos os processos
echo "⏹️  Parando processos..."
pkill -f "tsx server/index.ts" 2>/dev/null || true
pkill -f "chrome" 2>/dev/null || true
sleep 3

# Limpar arquivos de lock do WhatsApp
echo "🧹 Limpando arquivos de lock..."
rm -f whatsapp_session/session-zelar-whatsapp-bot/SingletonLock 2>/dev/null || true
find whatsapp_session -name "LOCK" -delete 2>/dev/null || true

# Reiniciar servidor
echo "🚀 Iniciando servidor..."
npm run dev 