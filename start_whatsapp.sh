#!/bin/bash

echo "🚀 Iniciando WhatsApp Bot Zelar..."

# Limpar processos antigos
pkill -f standalone_whatsapp.cjs 2>/dev/null

# Aguardar um momento
sleep 2

# Executar o bot
cd /home/runner/workspace
node standalone_whatsapp.cjs