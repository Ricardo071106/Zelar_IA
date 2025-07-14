#!/bin/bash

# Script de monitoramento e auto-restart do servidor
# Uso: ./monitor-server.sh

SERVER_URL="http://localhost:9000/health"
CHECK_INTERVAL=30  # segundos
MAX_FAILURES=3     # tentativas antes de reiniciar

echo "🚀 Iniciando monitoramento do servidor..."
echo "📡 URL: $SERVER_URL"
echo "⏱️  Intervalo de verificação: ${CHECK_INTERVAL}s"
echo "🔄 Máximo de falhas antes do restart: $MAX_FAILURES"
echo ""

failure_count=0

while true; do
    # Verificar se o servidor está respondendo
    if curl -s --max-time 10 "$SERVER_URL" > /dev/null 2>&1; then
        if [ $failure_count -gt 0 ]; then
            echo "$(date): ✅ Servidor voltou a funcionar!"
            failure_count=0
        else
            echo "$(date): ✅ Servidor funcionando normalmente"
        fi
    else
        failure_count=$((failure_count + 1))
        echo "$(date): ❌ Servidor não responde (falha $failure_count/$MAX_FAILURES)"
        
        if [ $failure_count -ge $MAX_FAILURES ]; then
            echo "$(date): 🔄 Reiniciando servidor..."
            
            # Parar processo atual
            pkill -f "tsx server/index.ts" 2>/dev/null || true
            sleep 2
            
            # Reiniciar servidor
            npm run dev &
            echo "$(date): ✅ Servidor reiniciado"
            
            # Aguardar um pouco antes de verificar novamente
            sleep 10
            failure_count=0
        fi
    fi
    
    sleep $CHECK_INTERVAL
done 