#!/bin/bash

echo "🧪 Testando Telegram Bot..."
echo "URL: https://zelar-ia.onrender.com"
echo ""

echo "📊 Status do servidor:"
curl -s https://zelar-ia.onrender.com/health | jq '.'

echo ""
echo "📱 Para testar o bot:"
echo "1. Abra o Telegram"
echo "2. Procure pelo seu bot"
echo "3. Envie: /start"
echo "4. Envie: 'Agendar reunião amanhã às 14h'"
echo ""

echo "🔍 Monitorando logs (Ctrl+C para parar):"
echo "----------------------------------------"

while true; do
    echo "$(date '+%H:%M:%S') - Verificando status..."
    health=$(curl -s https://zelar-ia.onrender.com/health)
    echo "Status: $health"
    echo "----------------------------------------"
    sleep 10
done 