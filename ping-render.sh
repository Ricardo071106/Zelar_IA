#!/bin/bash

# Script para manter o Render ativo 24/7
# Faz ping a cada 10 minutos

URL="https://zelar-ia.onrender.com"
LOG_FILE="ping-log.txt"

echo "🚀 Iniciando ping automático para manter Render ativo..."
echo "📡 URL: $URL"
echo "⏰ Intervalo: 10 minutos"
echo "📝 Log: $LOG_FILE"
echo ""

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$TIMESTAMP] 🔄 Fazendo ping..."
    
    # Fazer ping para o site
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
    
    if [ "$RESPONSE" = "200" ]; then
        echo "[$TIMESTAMP] ✅ Sucesso! Status: $RESPONSE" | tee -a "$LOG_FILE"
    else
        echo "[$TIMESTAMP] ❌ Erro! Status: $RESPONSE" | tee -a "$LOG_FILE"
    fi
    
    echo "[$TIMESTAMP] ⏳ Aguardando 10 minutos..." | tee -a "$LOG_FILE"
    echo ""
    
    # Aguardar 5 minutos (300 segundos) - mais frequente para evitar hibernação
    sleep 300
done 