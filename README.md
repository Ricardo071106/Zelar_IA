# TelegramScheduler - Sistema de Agendamento Inteligente

Sistema completo de agendamento com bots do Telegram e WhatsApp, interface web moderna e integração com calendários.

## 🚀 Deploy na AWS Elastic Beanstalk

### Pré-requisitos

1. **Conta AWS** com acesso ao Elastic Beanstalk
2. **EB CLI** instalado: `pip install awsebcli`
3. **Node.js 18+** instalado localmente
4. **Banco de dados PostgreSQL** (recomendado: Neon)
5. **Token do bot do Telegram** (obrigatório)

### 📋 Passos para Deploy

#### 1. Configurar AWS CLI e EB CLI

```bash
# Instalar EB CLI
pip install awsebcli

# Configurar credenciais AWS
aws configure

# Inicializar EB CLI no projeto
eb init
```

#### 2. Configurar Variáveis de Ambiente

Copie o arquivo `env.example` para `.env` e configure:

```bash
cp env.example .env
```

**Variáveis OBRIGATÓRIAS:**
- `DATABASE_URL` - URL do banco PostgreSQL
- `TELEGRAM_BOT_TOKEN` - Token do seu bot do Telegram
- `SESSION_SECRET` - Chave secreta para sessões

**Variáveis OPCIONAIS:**
- `SENDGRID_API_KEY` - Para envio de emails
- `OPENAI_API_KEY` - Para funcionalidades de IA
- `ANTHROPIC_API_KEY` - Para funcionalidades de IA

#### 3. Deploy Automatizado (Recomendado)

```bash
# Executar script de deploy
./deploy-aws.sh
```

#### 4. Deploy Manual

```bash
# Build local
npm install
npm run build

# Criar arquivo de deploy
zip -r deploy.zip . -x "node_modules/*" ".git/*" "*.log" ".DS_Store"

# Deploy via EB CLI
eb create telegram-scheduler-prod --elb-type application --instance-type t3.small
```

#### 5. Configurar Variáveis no AWS Console

1. Acesse o console AWS Elastic Beanstalk
2. Selecione seu ambiente
3. Vá em **Configuration** > **Software**
4. Adicione as variáveis de ambiente necessárias

### 🔧 Configurações do Ambiente

O projeto inclui configurações otimizadas para AWS:

- **Instância**: t3.small (1 vCPU, 2GB RAM)
- **Auto Scaling**: 1-4 instâncias
- **Health Checks**: Habilitados
- **Load Balancer**: Application Load Balancer
- **Porta**: 8080

### 📊 Monitoramento

- **Health Check**: `/health`
- **Logs**: `eb logs telegram-scheduler-prod`
- **Status**: `eb status telegram-scheduler-prod`

### 🔄 Atualizações

```bash
# Deploy de atualizações
eb deploy telegram-scheduler-prod

# Ou usar o script automatizado
./deploy-aws.sh
```

### 🛠️ Scripts Disponíveis

- `npm run dev` - Ambiente de desenvolvimento
- `npm run build` - Build para produção
- `npm run start` - Servidor de produção
- `./deploy-aws.sh` - Deploy automatizado

### 📁 Estrutura do Projeto

```
TelegramScheduler/
├── client/          # Frontend React + Vite
├── server/          # Backend Express + TypeScript
├── shared/          # Schemas compartilhados
├── .ebextensions/   # Configurações AWS
├── deploy-aws.sh    # Script de deploy
└── env.example      # Exemplo de variáveis
```

### 🔍 Troubleshooting

#### Problemas Comuns

1. **Build falha**: Verifique se todas as dependências estão no `package.json`
2. **Erro de conexão com banco**: Verifique `DATABASE_URL`
3. **Bot não responde**: Verifique `TELEGRAM_BOT_TOKEN`
4. **Erro de memória**: Aumente o tipo de instância para t3.medium

#### Logs e Debug

```bash
# Ver logs em tempo real
eb logs --follow telegram-scheduler-prod

# Verificar status
eb health telegram-scheduler-prod

# SSH na instância (se necessário)
eb ssh telegram-scheduler-prod
```

### 💰 Custos Estimados

- **t3.small**: ~$15-20/mês
- **Load Balancer**: ~$20/mês
- **Storage**: ~$5-10/mês
- **Total estimado**: ~$40-50/mês

### 🔐 Segurança

- Todas as variáveis sensíveis devem ser configuradas no AWS Console
- Nunca commite arquivos `.env` no Git
- Use HTTPS em produção
- Configure CORS adequadamente

---

**Suporte**: Para dúvidas, consulte a documentação da AWS ou abra uma issue no projeto. 