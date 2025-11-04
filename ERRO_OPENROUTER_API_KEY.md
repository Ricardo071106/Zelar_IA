# ❌ Erro: API Key do OpenRouter/Claude Não Configurada

## 🔍 Problema Identificado

O bot está tentando usar o Claude (via OpenRouter) para interpretar eventos, mas a API key está indefinida:

```
Authorization: Bearer undefined
Status: 401 Unauthorized
```

---

## ✅ Solução

### **Passo 1: Obter API Key do OpenRouter**

1. Acesse: https://openrouter.ai/
2. Crie uma conta (se não tiver)
3. Vá em **Keys** → **Create Key**
4. Copie a chave (começa com `sk-or-v1-...`)

**OU use a API direta do Anthropic:**

1. Acesse: https://console.anthropic.com/
2. Vá em **API Keys**
3. Crie uma nova chave
4. Copie a chave (começa com `sk-ant-...`)

---

### **Passo 2: Adicionar no arquivo `.env`**

Abra o arquivo `.env` e adicione:

**Para OpenRouter (recomendado - mais barato):**
```env
OPENROUTER_API_KEY=sk-or-v1-sua-chave-aqui
```

**OU para Anthropic direto:**
```env
ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui
```

---

### **Passo 3: Reiniciar o servidor**

```bash
npm start
```

---

## 📊 Seu `.env` atual

```env
TELEGRAM_BOT_TOKEN=✅ Configurado
DATABASE_URL=✅ Configurado
GOOGLE_CLIENT_ID=✅ Configurado
GOOGLE_CLIENT_SECRET=✅ Configurado
GOOGLE_REDIRECT_URI=✅ Configurado
BASE_URL=✅ Configurado

OPENROUTER_API_KEY=❌ FALTANDO! <-- Adicione aqui
```

---

## 🎯 Arquivo `.env` Completo (Exemplo)

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=8319344005:AAFq61k8cpWbn-koBHiH0woHUB-PGBtfrS4

# Database
DATABASE_URL=postgresql://neondb_owner:npg_dL41EiBODnHT@ep-long-darkness-a4zffpr7-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Bots Config
ENABLE_WHATSAPP_BOT=true
REQUIRE_TELEGRAM=true

# Google Calendar OAuth
GOOGLE_CLIENT_ID=168038997387-98f5db92i0mfauo0q943a15nq8arahnd.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback

# Server
BASE_URL=http://localhost:8080

# AI - OpenRouter (para Claude)
OPENROUTER_API_KEY=sk-or-v1-SUA-CHAVE-AQUI
```

---

## 🧪 Como Testar Após Configurar

1. **Adicionar a chave no `.env`**

2. **Reiniciar servidor:**
   ```bash
   npm start
   ```

3. **Enviar mensagem no Telegram:**
   ```
   reunião do nexus amanhã 18h
   ```

4. **Resultado esperado:**
   ```
   ✅ Evento criado com sucesso!
   📅 Reunião do nexus
   🕒 04/11/2025 às 18:00
   ```

---

## 💰 Custos

### **OpenRouter (Recomendado)**
- Claude 3 Haiku: **$0.25 por 1M tokens de input**
- Muito barato para uso pessoal
- Suporta múltiplos modelos

### **Anthropic Direto**
- Claude 3 Haiku: **$0.25 por 1M tokens de input**
- Acesso direto à API
- Mais estável

**Estimativa de uso:**
- Cada mensagem: ~1000 tokens = $0.00025
- 1000 eventos: ~$0.25
- 10.000 eventos: ~$2.50

---

## 🔧 Alternativa: Usar Parsing Simples (Sem IA)

Se não quiser usar IA, você pode desabilitar o Claude e usar apenas regex:

No arquivo `server/telegram/direct_bot.ts`, procure por:

```typescript
const parsed = await parseEventWithClaude(message, timezone);
```

E substitua por:

```typescript
// Usar parser simples sem IA
const parsed = parseEventSimple(message, timezone);
```

**Desvantagem:** Menos preciso, não entende contexto complexo.

---

## 📝 Próximos Passos

1. ✅ Obter API key do OpenRouter/Anthropic
2. ✅ Adicionar `OPENROUTER_API_KEY` no `.env`
3. ✅ Reiniciar servidor
4. ✅ Testar criação de evento no Telegram
5. ✅ Verificar logs: `🤖 Claude interpretou: ...`

---

**Problema:** `Authorization: Bearer undefined`  
**Causa:** Falta `OPENROUTER_API_KEY` no `.env`  
**Solução:** Adicionar chave e reiniciar servidor

---

## 🔗 Links Úteis

- OpenRouter: https://openrouter.ai/
- Anthropic: https://console.anthropic.com/
- Documentação Claude: https://docs.anthropic.com/
