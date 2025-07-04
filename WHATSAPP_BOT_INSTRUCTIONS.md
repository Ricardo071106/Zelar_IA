# WhatsApp Bot - Sistema Completo

## Como Funciona

### 1. Botão WhatsApp no Site
- **Botão flutuante verde** (canto inferior direito)
- Aparece apenas quando WhatsApp está conectado
- Redireciona para conversa direta via `wa.me`
- Mensagem automática: "Olá! Gostaria de agendar um compromisso 📅"

### 2. Bot Inteligente via ZAPI
- **Mesmo processamento do Telegram**: Usa Claude AI para interpretar mensagens
- **Respostas automáticas**: Cria eventos e gera links de calendário
- **Webhook configurado**: Recebe e responde mensagens automaticamente

### 3. Configuração Completa

#### Passo 1: Conectar WhatsApp
1. Acesse a seção "WhatsApp via ZAPI" 
2. Clique em "Conectar WhatsApp"
3. Escaneie o QR code com seu WhatsApp

#### Passo 2: Configurar Bot
1. Após conectar, clique em "Configurar Bot"
2. Isso ativa as respostas automáticas
3. Agora o WhatsApp responderá igual ao Telegram

### 4. Como Usar

#### Para Visitantes do Site:
1. Veem o botão WhatsApp flutuante
2. Clicam para abrir conversa
3. Enviam mensagens como:
   - "reunião amanhã às 15h"
   - "jantar sexta às 19h30"
   - "consulta médica na terça às 9h"

#### Respostas Automáticas:
- **Evento reconhecido**: Cria evento + link do Google Calendar
- **Não entendeu**: Sugestões de como escrever corretamente

## Endpoints Implementados

- `GET /api/whatsapp/info` - Informações do WhatsApp (número, status)
- `POST /api/zapi/webhook` - Recebe mensagens e responde automaticamente
- `POST /api/zapi/setup-webhook` - Configura o webhook da ZAPI

## Fluxo de Dados

1. **Usuário envia mensagem** → ZAPI recebe
2. **ZAPI envia webhook** → `/api/zapi/webhook`
3. **Claude AI processa** → Interpreta a mensagem
4. **Sistema cria evento** → Gera links de calendário
5. **ZAPI envia resposta** → Usuário recebe confirmação

## Benefícios

✅ **Mesma inteligência** do bot Telegram
✅ **Interface familiar** do WhatsApp
✅ **Zero configuração** para usuários finais
✅ **Respostas instantâneas** via webhook
✅ **Links diretos** para Google Calendar