# 🚀 Guia de Deploy - TelegramScheduler

## Problemas com Render
- ❌ Logs limitados e difíceis de debugar
- ❌ Hibernação frequente (desconecta WhatsApp)
- ❌ Reinicializações que perdem sessão
- ❌ Limitações de WebSocket

## ✅ Alternativas Recomendadas

### 1. Railway (RECOMENDADO)
**Por que é melhor:**
- ✅ Logs em tempo real e detalhados
- ✅ Sem hibernação no plano gratuito
- ✅ Excelente suporte a WebSockets
- ✅ Deploy mais estável
- ✅ Variáveis de ambiente fáceis

**Como fazer deploy:**
1. Acesse [railway.app](https://railway.app)
2. Conecte seu GitHub
3. Selecione o repositório `Zelar_IA`
4. Railway detectará automaticamente o `railway.json`
5. Adicione as variáveis de ambiente:
   ```
   TELEGRAM_BOT_TOKEN=seu_token_aqui
   DATABASE_URL=sua_url_do_neon_aqui
   PORT=10000
   ```
6. Deploy automático!

### 2. Vercel + Railway (Arquitetura Separada)
**Frontend (Vercel):**
- Deploy do cliente React
- Domínio personalizado
- CDN global

**Backend (Railway):**
- API e bots
- WebSockets estáveis
- Logs detalhados

### 3. DigitalOcean App Platform
- Mais controle
- Logs excelentes
- $5/mês (mais estável)

## 🔧 Configuração Atual

O projeto já está configurado para funcionar em qualquer plataforma:

- ✅ `railway.json` - Configuração do Railway
- ✅ `Procfile` - Heroku/Railway
- ✅ `render.yaml` - Render (atual)
- ✅ `package.json` - Scripts universais

## 🎯 Recomendação

**Mude para Railway AGORA!**

1. É gratuito
2. Logs muito melhores
3. WhatsApp funcionará corretamente
4. Deploy em 2 minutos

## 📱 Depois do Deploy

Com Railway você verá:
```
🚀 Inicializando WhatsApp Bot...
🔧 Configurando autenticação...
📱 QR Code recebido!
========================================
📱 ESCANEIE O QR CODE ABAIXO:
[QR CODE APARECERÁ AQUI NOS LOGS]
========================================
```

**Os logs do Railway são MUITO melhores que o Render!**