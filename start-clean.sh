#!/bin/bash

echo "🧹 Limpando processos anteriores..."
pkill -9 -f "node server/simple-server.js" 2>/dev/null
pkill -9 -f "npm start" 2>/dev/null
pkill -9 -f "node server.js" 2>/dev/null

echo "⏳ Aguardando 3 segundos..."
sleep 3

echo "🔍 Verificando se ainda há processos..."
ps aux | grep -E "(node server|npm start)" | grep -v grep

echo "🚀 Iniciando servidor..."
npm start 