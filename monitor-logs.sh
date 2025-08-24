#!/bin/bash

echo "🔍 Monitorando logs do Render..."
echo "URL: https://zelar-ia.onrender.com"
echo ""

while true; do
    echo "📊 $(date '+%H:%M:%S') - Verificando status..."
    
    # Verificar health
    health=$(curl -s https://zelar-ia.onrender.com/health)
    echo "🏥 Health: $health"
    
    # Verificar WhatsApp status
    whatsapp=$(curl -s https://zelar-ia.onrender.com/api/whatsapp/status)
    echo "📱 WhatsApp: $whatsapp"
    
    # Verificar QR code
    qr=$(curl -s https://zelar-ia.onrender.com/api/whatsapp/qr)
    echo "🔗 QR Code: $qr"
    
    echo "----------------------------------------"
    sleep 10
done 