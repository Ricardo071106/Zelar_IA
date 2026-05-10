# Zelar IA - WhatsApp Assistant 🤖

Um assistente inteligente para WhatsApp que ajuda a gerenciar eventos e lembretes, integrado com Google Calendar, Microsoft Calendar e Google AI (Gemini/Claude).

## 🚀 Funcionalidades

- **Interpretação Inteligente**: Crie eventos com linguagem natural (ex: "Jantar com Maria sexta às 20h").
- **Integração de Calendário**: Sincronização automática com Google Calendar ou Microsoft Calendar (Outlook).
- **Sistema de Lembretes**: Lembretes automáticos 12h antes do evento via WhatsApp.
- **Comandos Completos**: Gerencie tudo pelo chat (`/eventos`, `/deletar`, etc.).
- **Multi-plataforma**: Suporte para múltiplos usuários com verificação de assinatura Premium.

## 🛠️ Tecnologias

- **Backend**: Node.js, Express, TypeScript
- **Banco de Dados**: PostgreSQL (via NeonDB), Drizzle ORM
- **WhatsApp**: @whiskeysockets/baileys
- **IA**: OpenRouter (Claude Haiku)
- **Pagamentos**: Stripe

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL
- Conta no Google Cloud (opcional, para Google Calendar API)
- Conta no Microsoft Entra/Azure (opcional, para Microsoft Calendar API)
- Conta na OpenRouter (para IA)
- Conta no Stripe (para assinaturas)

## ⚙️ Configuração

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/zelar-ia.git
    cd zelar-ia
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure as Variáveis de Ambiente:**
    Crie um arquivo `.env` na raiz com o seguinte modelo:

    ```env
    # Servidor
    PORT=5000
    BASE_URL=https://seu-dominio-ngrok.app

    # Banco de Dados
    DATABASE_URL=postgresql://usuario:senha@host/db

    # Google Integration
    GOOGLE_CLIENT_ID=seu_client_id
    GOOGLE_CLIENT_SECRET=seu_client_secret
    GOOGLE_REDIRECT_URI=https://seu-dominio-ngrok.app/api/auth/google/callback

    # Microsoft Integration
    MICROSOFT_CLIENT_ID=seu_app_client_id
    MICROSOFT_CLIENT_SECRET=seu_app_client_secret
    MICROSOFT_TENANT_ID=common
    MICROSOFT_REDIRECT_URI=https://seu-dominio-ngrok.app/api/auth/microsoft/callback

    # AI (OpenRouter)
    OPENROUTER_API_KEY=sk-or-...

    # Stripe (Pagamentos)
    STRIPE_SECRET_KEY=sk_test_...
    STRIPE_WEBHOOK_SECRET=whsec_...
    STRIPE_PAYMENT_LINK=https://buy.stripe.com/test_...
    STRIPE_PRICE_ID=price_...

    # WhatsApp
    ENABLE_WHATSAPP_BOT=true
    ```

4.  **Banco de Dados:**
    Gere e aplique as migrações:
    ```bash
    npm run db:generate
    npm run db:migrate
    ```

## ▶️ Como Rodar

### Modo Desenvolvimento
```bash
npm run dev
```

### Modo Produção
```bash
npm run build
npm start
```

## 📱 Comandos do Bot

- **/start**: Inicia a conversa e mostra boas-vindas.
- **/conectar**: Gera link para conectar ao Google Calendar.
- **/conectar_microsoft**: Gera link para conectar ao Microsoft Calendar.
- **/eventos**: Lista seus próximos eventos agendados.
- **/lembretes**: Mostra lembretes pendentes.
- **/deletar ID**: Remove um evento pelo ID.
- **/fuso [Região]**: Altera seu fuso horário (ex: `/fuso America/Sao_Paulo`).
- **/ajuda**: Mostra lista de comandos.

## 🧠 Como usar a IA

Basta digitar naturalmente:
- _"Consulta médica amanhã às 14h"_
- _"Reunião de projeto terça que vem às 10 da manhã"_
- _"Aniversário do Pedro dia 25/12"_

## 📁 Estrutura do Projeto

- `/server`: Código do backend
  - `/whatsapp`: Lógica do bot (Baileys)
  - `/services`: Serviços (IA, Lembretes, Stripe)
  - `/routes`: Rotas da API e Webhooks
  - `/telegram`: Legado/Integrações Calendar
- `/shared`: Schemas do Drizzle
- `/migrations`: Arquivos SQL de migração

---
Desenvolvido com 💜 por Zelar IA Team.