#!/bin/bash

# Instalar dependências do sistema para Chromium
apt-get update
apt-get install -y \
    chromium-browser \
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
    libxss1

# Instalar dependências do Node.js
npm install

# Build do frontend
npm run build

echo "✅ Build concluído com sucesso!" 