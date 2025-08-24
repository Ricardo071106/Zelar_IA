#!/bin/bash

echo "🔍 Verificando status do deploy no Render..."
echo "URL: https://zelar-ia.onrender.com"

echo ""
echo "📊 Testando healthcheck..."
curl -s https://zelar-ia.onrender.com/health

echo ""
echo "🏠 Testando rota principal..."
curl -s https://zelar-ia.onrender.com/

echo ""
echo "📱 Testando status do WhatsApp..."
curl -s https://zelar-ia.onrender.com/api/whatsapp/status

echo ""
echo "✅ Verificação concluída!" 