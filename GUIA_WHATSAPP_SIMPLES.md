# WhatsApp Business - Guia Simples com Z-API

## O que você precisa fazer (5 minutos):

### 1. Cadastrar no Z-API (Serviço Brasileiro)
- Acesse: `https://z-api.io`
- Clique em "Criar Conta"
- Faça o cadastro (email + senha)
- Confirme o email

### 2. Criar uma Instância
- No painel do Z-API, clique "Criar Instância"
- Escolha um nome (ex: "meu-bot-zelar")
- Anote o **Instance ID** e **Token** que aparecem

### 3. Configurar no Zelar
- Acesse: `http://localhost:5000/whatsapp-simples`
- Preencha os campos:
  - **Instance ID**: (cole do Z-API)
  - **Token**: (cole do Z-API)  
  - **Seu Número**: seu WhatsApp com código do país (ex: 5511999999999)
- Clique "Configurar Z-API"

### 4. Conectar seu WhatsApp
- Clique "Conectar WhatsApp"
- QR Code aparece na tela
- Abra WhatsApp no celular → Dispositivos Vinculados → Vincular Dispositivo
- Escaneie o QR Code

### 5. Configurar Webhook (Opcional)
- No painel Z-API, vá em "Webhooks"
- Cole esta URL: `https://sua-app.replit.app/api/zapi/webhook`
- Salve

## Pronto! Agora funciona assim:

1. **Alguém manda mensagem para seu WhatsApp**:
   - "me lembre de reunião amanhã às 15h"

2. **Bot responde automaticamente**:
   - ✅ Evento criado!
   - 🎯 **Reunião**
   - 📅 23/06/2025 15:00
   - 🔗 Links para Google Calendar e Outlook

## Custos:
- Z-API: Plano gratuito tem 100 mensagens/mês
- Zelar: Totalmente grátis
- Total: R$ 0,00 para começar

## Links importantes:
- **Z-API**: https://z-api.io
- **Painel Zelar**: http://localhost:5000/whatsapp-simples
- **App Principal**: http://localhost:5000

## Suporte:
Se algo não funcionar:
1. Verifique se copiou Instance ID e Token corretos
2. Confirme que o número está no formato: 5511999999999
3. Teste mandando "iniciar" para seu número

É isso! Muito mais simples que servidores e GitHub.