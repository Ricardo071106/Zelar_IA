# 📅 Guia de Integração Google Calendar

## 🔑 Pré-requisitos

### 1. Informações necessárias do Google Cloud Console

Você precisa obter do seu projeto Google Cloud:

1. **Client ID** - ID do cliente OAuth 2.0
2. **Client Secret** - Segredo do cliente OAuth 2.0
3. **Redirect URIs** - URLs autorizadas para callback

### 2. Onde encontrar essas informações:

1. Acesse: https://console.cloud.google.com
2. Selecione seu projeto
3. Vá em: **APIs & Services** → **Credentials**
4. Clique no seu cliente OAuth 2.0
5. Copie:
   - **Client ID**: algo como `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: string aleatória
   - **Authorized redirect URIs**: deve incluir sua URL de callback

---

## ⚙️ Configuração

### Passo 1: Adicionar credenciais ao .env

Cole suas credenciais do Google Cloud no arquivo `.env`:

```env
# Google Calendar OAuth
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback
```

**Para produção, use a URL real:**
```env
GOOGLE_REDIRECT_URI=https://seu-dominio.com/api/auth/google/callback
```

---

## 🔧 URIs de Redirecionamento

### No Google Cloud Console, adicione estas URIs:

**Desenvolvimento:**
```
http://localhost:8080/api/auth/google/callback
```

**Produção:**
```
https://seu-dominio.com/api/auth/google/callback
```

---

## 🚀 Como Funciona

### Fluxo OAuth 2.0:

```
1. Usuário envia /conectar no Telegram/WhatsApp
   ↓
2. Bot gera URL de autorização do Google
   ↓
3. Usuário clica no link e autoriza o app
   ↓
4. Google redireciona para REDIRECT_URI com código
   ↓
5. Servidor troca código por tokens (access + refresh)
   ↓
6. Tokens são salvos no banco (user_settings.google_tokens)
   ↓
7. Bot pode criar eventos no Google Calendar do usuário
```

---

## 📝 Comandos Disponíveis

### Para o usuário:

- `/conectar` - Conectar conta Google
- `/desconectar` - Remover conexão
- `/status` - Ver status da conexão

### Criação automática:

Quando o usuário enviar: **"reunião amanhã às 14h"**

O bot vai:
1. Extrair informações com IA
2. Salvar no banco PostgreSQL
3. **Criar evento automaticamente no Google Calendar** ✨
4. Enviar confirmação com link do evento

---

## 🔒 Segurança

### Tokens são armazenados de forma segura:

- **Access Token**: Expira em 1 hora
- **Refresh Token**: Usado para renovar access token
- **Armazenamento**: Criptografado no campo `google_tokens` (JSONB)

### Renovação automática:

O sistema detecta quando o access token expira e renova automaticamente usando o refresh token.

---

## 📊 Estrutura no Banco

### Tabela: `user_settings`

```sql
google_tokens: TEXT  -- JSON com:
{
  "access_token": "ya29...",
  "refresh_token": "1//...",
  "scope": "https://www.googleapis.com/auth/calendar",
  "token_type": "Bearer",
  "expiry_date": 1234567890000
}
```

---

## 🧪 Testando

### 1. Verificar se credenciais estão configuradas:

```bash
npm run start
```

Procure no log:
```
✅ Google Calendar configurado
```

Ou:
```
⚠️ Google Calendar não configurado (falta GOOGLE_CLIENT_ID)
```

### 2. Testar fluxo completo:

1. Envie `/conectar` no Telegram
2. Clique no link de autorização
3. Autorize o acesso
4. Volte ao bot
5. Crie um evento: "reunião amanhã às 15h"
6. Verifique no Google Calendar se o evento foi criado

---

## 🐛 Solução de Problemas

### Erro: "redirect_uri_mismatch"

**Causa:** A URI de redirecionamento não está autorizada no Google Cloud.

**Solução:**
1. Vá em: Google Cloud Console → Credentials
2. Edite seu OAuth 2.0 Client
3. Adicione a URI exata em "Authorized redirect URIs"
4. Salve e aguarde 5 minutos

### Erro: "invalid_grant"

**Causa:** Refresh token inválido ou expirado.

**Solução:**
1. Usuário precisa desconectar: `/desconectar`
2. Conectar novamente: `/conectar`
3. Reautorizar o aplicativo

### Erro: "insufficient_permissions"

**Causa:** Escopo de permissões insuficiente.

**Solução:**
Certifique-se de que o escopo inclui:
```
https://www.googleapis.com/auth/calendar
```

---

## 📈 Recursos Implementados

### ✅ Já Implementado:

- OAuth 2.0 completo
- Geração de URL de autorização
- Troca de código por tokens
- Renovação automática de tokens
- Criação de eventos
- Criação automática de Google Meet
- Detecção de intenção de videoconferência
- Armazenamento seguro de tokens

### 🔄 Funcionalidades:

1. **Criar evento simples**
2. **Criar evento com Google Meet automático**
3. **Adicionar participantes**
4. **Definir lembretes**
5. **Sincronização com banco de dados**

---

## 🎯 Próximos Passos

Após configurar as credenciais:

1. ✅ Adicionar credenciais no `.env`
2. ✅ Configurar redirect URIs no Google Cloud
3. ✅ Reiniciar servidor
4. ✅ Testar comando `/conectar`
5. ✅ Criar evento de teste
6. ✅ Verificar no Google Calendar

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do servidor
2. Confirme que as credenciais estão corretas
3. Certifique-se que a API do Google Calendar está ativada
4. Verifique se as redirect URIs estão exatas

---

**💡 Dica:** Sempre use HTTPS em produção para maior segurança!
