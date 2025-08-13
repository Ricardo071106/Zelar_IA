#!/bin/bash

echo "🚀 Iniciando build no Render..."

# Atualizar repositórios
apt-get update

# Instalar dependências do sistema para Chromium
echo "📦 Instalando dependências do sistema..."
apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    chromium \
    chromium-sandbox \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libcairo-gobject2 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    fonts-liberation \
    xdg-utils

# Verificar se o Chromium foi instalado
echo "🔍 Verificando instalação do Chromium..."
which chromium-browser || which chromium || echo "❌ Chromium não encontrado"

# Instalar dependências do Node.js
echo "📦 Instalando dependências Node.js..."
npm install

# Build do frontend
echo "🔨 Fazendo build do frontend..."
npm run build

echo "✅ Build concluído com sucesso!" 