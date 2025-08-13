# Zelar - Assistente Inteligente

Sistema completo de agendamento com bots do Telegram e WhatsApp, interface web moderna e integração com calendários.

## 🚀 Deploy no Railway

### Pré-requisitos

1. **Conta Railway** (gratuita)
2. **Conta GitHub** para o repositório
3. **Banco de dados PostgreSQL** (recomendado: Neon)
4. **Token do bot do Telegram**

### 📋 Configuração Rápida

#### 1. Configurar Variáveis de Ambiente

Copie o arquivo `env.example` para `.env` e configure:

```bash
cp env.example .env
```

**Variáveis OBRIGATÓRIAS:**
- `DATABASE_URL` - URL do banco PostgreSQL (Neon)
- `TELEGRAM_BOT_TOKEN` - Token do seu bot do Telegram
- `ENABLE_WHATSAPP_BOT` - true

#### 2. Deploy no Railway

1. **Acesse [railway.app](https://railway.app)**
2. **Faça login com GitHub**
3. **Clique em "New Project"**
4. **Selecione "Deploy from GitHub repo"**
5. **Escolha seu repositório**
6. **Clique em "Deploy Now"**

### 🔧 Scripts Disponíveis

- `npm run dev` - Ambiente de desenvolvimento
- `npm run build` - Build para produção
- `npm run start` - Servidor de produção
- `npm run db:push` - Sincronizar banco de dados

### 📁 Estrutura do Projeto

```
Zelar/
├── client/          # Frontend React + Vite
├── server/          # Backend Express
├── shared/          # Schemas compartilhados
├── dist/            # Build de produção
└── env.example      # Exemplo de variáveis
```

### 🔍 Endpoints

- **Site principal**: `/`
- **Health check**: `/health`
- **WhatsApp QR**: `/api/whatsapp/qr`
- **Telegram webhook**: `/api/telegram/webhook`

### 📱 Funcionalidades

- ✅ **Bot do Telegram** - Agendamentos e lembretes
- ✅ **Bot do WhatsApp** - Interface conversacional
- ✅ **Interface Web** - Dashboard moderno
- ✅ **Banco de Dados** - PostgreSQL com Neon
- ✅ **Deploy Automático** - Railway + GitHub

### 🔐 Segurança

- Todas as variáveis sensíveis configuradas no Railway
- Nunca commite arquivos `.env` no Git
- HTTPS automático no Railway
- CORS configurado adequadamente

---

**Deploy**: https://web-production-783b8.up.railway.app/ 