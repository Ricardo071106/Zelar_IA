# Configuração e Uso do WhatsApp - Zelar Bot

## 🚀 Status Atual
- ✅ **WhatsApp implementado e funcionando**
- ✅ **Mesma funcionalidade do Telegram** (sem áudio)
- ✅ **Links de calendário e email funcionais**
- ✅ **Formatação otimizada para WhatsApp**

## 📱 Como Conectar

### 1. Verificar Status
Acesse: `https://zelar-ia.onrender.com/api/whatsapp/status`

**Respostas possíveis:**
- `"WhatsApp conectado e pronto para uso!"` - ✅ Conectado
- `"QR Code disponível para escaneamento"` - 📱 Precisa escanear QR
- `"Aguardando inicialização..."` - ⏳ Aguarde alguns segundos

### 2. Conectar WhatsApp
Se precisar conectar:

1. **Acesse**: `https://zelar-ia.onrender.com/api/whatsapp/qr`
2. **Abra o WhatsApp** no seu celular
3. **Toque em Menu** (3 pontos) → **Dispositivos conectados**
4. **Toque em Conectar dispositivo**
5. **Escaneie o QR code** que aparece na tela

### 3. Limpar Sessão (se necessário)
Se houver problemas:
- **POST**: `https://zelar-ia.onrender.com/api/whatsapp/clear`

## 🎯 Como Usar

### Enviar Mensagem
Envie uma mensagem para o número do WhatsApp conectado:

```
"marque um almoço com o Fred sexta às 12h e mande para o fred@maplink.global"
```

### Resposta do Bot
O bot responderá com:

```
✅ *Evento Agendado!*

📅 *Data:* sexta-feira, 29 de agosto de 2025
⏰ *Hora:* 12:00
📝 *Título:* Almoço com Fred
📧 *Para:* fred@maplink.global

📱 *Adicionar ao calendário:*
• 📅 Google Calendar
https://calendar.google.com/calendar/render?...

• 📅 Outlook
https://outlook.live.com/calendar/0/deeplink/...

📧 *Enviar convite por email:*
• 📨 Gmail (com convite)
https://mail.google.com/mail/u/0/#compose?...

• 📧 Gmail (alternativo)
https://mail.google.com/mail/u/0/#compose?...

• 📧 Email (cliente padrão)
https://mail.google.com/mail/u/0/#compose?...

• *Link mailto para copiar:*
`mailto:fred@maplink.global?...`
```

## 🔧 Funcionalidades

### ✅ Agendamento de Eventos
- **Reuniões, almoços, consultas, eventos**
- **Reconhecimento de datas** (hoje, amanhã, sexta, etc.)
- **Reconhecimento de horários** (12h, 14:30, etc.)
- **Extração de emails** automática

### ✅ Links de Calendário
- **Google Calendar** - Adicionar diretamente
- **Outlook** - Adicionar diretamente
- **Horário correto** (12h-13h)

### ✅ Links de Email
- **Gmail** - Link direto com convite
- **Gmail alternativo** - Versão simplificada
- **Email padrão** - Cliente de email
- **Mailto** - Para copiar e usar

### ✅ Compromissos Pessoais
Se não houver email na mensagem:
```
📝 *Compromisso pessoal agendado*
```

## 📝 Exemplos de Uso

### Com Email
```
"marcar reunião com João amanhã às 14h para joao@empresa.com"
"agendar almoço sexta às 12h e enviar para maria@gmail.com"
"consulta médica segunda às 9h para dr.silva@clinica.com"
```

### Sem Email (Pessoal)
```
"marcar reunião amanhã às 14h"
"agendar almoço sexta às 12h"
"consulta médica segunda às 9h"
```

## 🔍 Troubleshooting

### Problema: "WhatsApp não está conectado"
**Solução**: 
1. Verifique o status em `/api/whatsapp/status`
2. Se necessário, escaneie o QR code novamente
3. Use `/api/whatsapp/clear` para limpar e reconectar

### Problema: "Aguardando inicialização"
**Solução**: 
1. Aguarde alguns segundos
2. Verifique se o servidor está rodando
3. Tente novamente

### Problema: Links não funcionam
**Solução**: 
1. Os links são clicáveis no WhatsApp
2. Se não funcionar, copie e cole no navegador
3. Use o link mailto para email

## 📊 Logs de Monitoramento

O bot registra todas as interações:
```
💬 WhatsApp - De: 5511999999999@s.whatsapp.net
📝 Mensagem: "marque um almoço com o Fred sexta às 12h"
🕐 Timestamp: 28/08/2025, 21:53:11
🤖 Resposta gerada com sucesso!
📤 Enviando resposta para WhatsApp...
✅ Resposta enviada no WhatsApp!
```

## 🎯 Vantagens do WhatsApp

### ✅ Formatação Nativa
- **Negrito** com `*texto*`
- **Código** com `` `texto` ``
- **Links clicáveis** automáticos

### ✅ Compatibilidade
- **Funciona em qualquer dispositivo**
- **Não precisa de app específico**
- **Interface familiar**

### ✅ Confiabilidade
- **Mesma lógica do Telegram**
- **Fallback robusto**
- **Logs detalhados**

---
**Status**: WhatsApp funcionando perfeitamente! 📱✨
