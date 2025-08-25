#!/bin/bash

echo "🧹 Limpando TODOS os processos Node.js..."
pkill -9 -f "node server" 2>/dev/null
pkill -9 -f "npm start" 2>/dev/null
pkill -9 -f "node server/simple-server.js" 2>/dev/null

echo "⏳ Aguardando 5 segundos..."
sleep 5

echo "🔍 Verificando se ainda há processos..."
ps aux | grep -E "(node server|npm start)" | grep -v grep

echo "🚀 Iniciando servidor..."
echo "📝 Para parar o servidor, pressione Ctrl+C"
echo ""

npm start 