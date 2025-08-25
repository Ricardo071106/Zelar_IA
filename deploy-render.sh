#!/bin/bash

echo "🚀 Iniciando deploy para o Render..."

# 1. Fazer o build do frontend
echo "📦 Fazendo build do frontend..."
npm run build

# 2. Verificar se o build foi criado
if [ ! -d "dist" ]; then
    echo "❌ Erro: Build não foi criado!"
    exit 1
fi

echo "✅ Build criado com sucesso!"

# 3. Verificar se os arquivos estão no lugar certo
if [ ! -f "dist/public/index.html" ]; then
    echo "❌ Erro: index.html não encontrado!"
    exit 1
fi

echo "✅ Arquivos do frontend verificados!"

# 4. Fazer commit das mudanças
echo "📝 Fazendo commit das mudanças..."
git add .
git commit -m "Fix: Corrigindo configuração do Render e build do frontend"

# 5. Push para o repositório
echo "📤 Fazendo push para o repositório..."
git push

echo "🎉 Deploy iniciado! O Render irá fazer o build automaticamente."
echo "🌐 Site: https://zelar-ia.onrender.com"
echo "⏳ Aguarde alguns minutos para o deploy ser concluído." 