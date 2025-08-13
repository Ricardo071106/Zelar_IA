#!/bin/bash

# Script de Deploy para AWS Elastic Beanstalk
# TelegramScheduler

set -e

echo "🚀 Iniciando deploy do TelegramScheduler na AWS..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Verificar se o EB CLI está instalado
if ! command -v eb &> /dev/null; then
    error "EB CLI não encontrado. Instale com: pip install awsebcli"
    exit 1
fi

# Verificar se está logado na AWS
if ! eb status &> /dev/null; then
    error "Não está logado na AWS. Execute: eb init"
    exit 1
fi

# Nome da aplicação e ambiente
APP_NAME="telegram-scheduler"
ENV_NAME="telegram-scheduler-prod"

log "📦 Preparando build local..."

# Limpar builds anteriores
rm -rf dist/
rm -rf build/

# Instalar dependências
log "📥 Instalando dependências..."
npm install

# Build do projeto
log "🔨 Fazendo build do projeto..."
npm run build

# Verificar se o build foi bem-sucedido
if [ ! -d "dist" ]; then
    error "Build falhou! Pasta dist/ não foi criada."
    exit 1
fi

log "✅ Build concluído com sucesso!"

# Criar arquivo de deploy
log "📦 Criando arquivo de deploy..."
zip -r deploy.zip . -x "node_modules/*" ".git/*" "*.log" ".DS_Store" "whatsapp_session/*" ".wwebjs_cache/*" ".wwebjs_auth/*" "test-*" "*.test.*" "*.spec.*"

# Verificar se o arquivo foi criado
if [ ! -f "deploy.zip" ]; then
    error "Falha ao criar arquivo deploy.zip"
    exit 1
fi

log "📊 Tamanho do arquivo de deploy: $(du -h deploy.zip | cut -f1)"

# Deploy para AWS
log "☁️  Fazendo deploy para AWS Elastic Beanstalk..."

# Verificar se o ambiente existe
if eb status $ENV_NAME &> /dev/null; then
    log "🔄 Atualizando ambiente existente..."
    eb deploy $ENV_NAME --staged
else
    log "🆕 Criando novo ambiente..."
    eb create $ENV_NAME --elb-type application --instance-type t3.small --min-instances 1 --max-instances 4
fi

# Aguardar deploy
log "⏳ Aguardando deploy..."
eb status $ENV_NAME

# Verificar health
log "🏥 Verificando saúde da aplicação..."
sleep 30

# Tentar acessar a aplicação
if curl -f http://$(eb status $ENV_NAME | grep CNAME | awk '{print $2}')/health &> /dev/null; then
    log "✅ Deploy concluído com sucesso!"
    log "🌐 URL da aplicação: http://$(eb status $ENV_NAME | grep CNAME | awk '{print $2}')"
else
    warn "⚠️  Deploy pode ter problemas. Verifique os logs: eb logs $ENV_NAME"
fi

# Limpar arquivo temporário
rm -f deploy.zip

log "🎉 Processo de deploy finalizado!" 