# WhatsApp Business Integration com Evolution API

## Visão Geral

O bot Zelar agora suporta WhatsApp Business através da Evolution API, oferecendo a mesma funcionalidade inteligente de criação de eventos que o bot do Telegram.

## Recursos

- 🤖 Interpretação inteligente de mensagens usando Claude Haiku
- 📅 Geração automática de links para Google Calendar e Outlook
- 🌍 Suporte completo ao fuso horário brasileiro
- 📱 Interface de administração web
- 🔄 Sistema de aprendizado que melhora com o uso
- ✅ Integração com Evolution API

## Configuração Rápida

### 1. Configurar Evolution API

Você precisa de uma instância da Evolution API funcionando. Se não tiver, configure uma seguindo a documentação oficial.

### 2. Configurar Variáveis de Ambiente

Adicione estas variáveis ao seu arquivo `.env`:

```env
EVOLUTION_API_URL=https://sua-api.evolution.com
EVOLUTION_INSTANCE_NAME=sua-instancia
EVOLUTION_API_KEY=sua-api-key
WEBHOOK_URL=https://sua-app.replit.app/api/whatsapp/webhook
```

### 3. Inicializar WhatsApp

Execute o script de configuração:

```bash
tsx start_whatsapp.ts
```

Ou acesse o painel de administração em: `http://localhost:5000/whatsapp`

### 4. Conectar WhatsApp

1. Acesse o painel de administração
2. Configure a Evolution API com suas credenciais
3. Escaneie o QR Code com o WhatsApp Business
4. Configure o webhook automaticamente

## Como Usar

### Comandos Básicos

- `iniciar` ou `/start` - Inicia interação com o bot
- Mensagens naturais para criar eventos

### Exemplos de Mensagens

```
"me lembre de ligar para João amanhã às 15h"
→ Cria evento: "Ligar para João" para amanhã às 15:00

"reunião com cliente sexta às 10"
→ Cria evento: "Reunião com cliente" para próxima sexta às 10:00

"consulta médica daqui 3 dias às 14:30"
→ Cria evento: "Consulta médica" para daqui 3 dias às 14:30
```

## API Endpoints

### POST `/api/whatsapp/setup`
Configura a conexão com Evolution API

```json
{
  "baseUrl": "https://sua-api.evolution.com",
  "instanceName": "sua-instancia", 
  "apiKey": "sua-api-key"
}
```

### POST `/api/whatsapp/webhook`
Recebe mensagens do WhatsApp (configurado automaticamente)

### GET `/api/whatsapp/status`
Verifica status da conexão e obtém QR Code se necessário

### POST `/api/whatsapp/configure-webhook`
Configura webhook na Evolution API

```json
{
  "webhookUrl": "https://sua-app.replit.app/api/whatsapp/webhook"
}
```

## Painel de Administração

Acesse `http://localhost:5000/whatsapp` para:

- Configurar Evolution API
- Visualizar status da conexão
- Escanear QR Code
- Configurar webhook
- Monitorar atividade

## Funcionalidades Avançadas

### Sistema de Aprendizado
O bot aprende com interpretações bem-sucedidas do Claude, melhorando respostas para padrões similares.

### Fuso Horário Inteligente
Todos os eventos são criados no fuso horário brasileiro (America/Sao_Paulo) automaticamente.

### Fallback Local
Se o Claude falhar, o bot usa interpretação local básica para manter funcionalidade.

### Links Diretos
Gera links diretos para adicionar eventos no Google Calendar e Outlook sem necessidade de login.

## Troubleshooting

### WhatsApp Não Conecta
1. Verifique se a Evolution API está online
2. Confirme as credenciais no painel admin
3. Gere novo QR Code se necessário

### Mensagens Não São Processadas
1. Verifique se o webhook está configurado corretamente
2. Confirme se a URL do webhook está acessível publicamente
3. Monitore logs do servidor para erros

### Claude Não Funciona
1. Verifique se `OPENROUTER_API_KEY` está configurada
2. O bot usa fallback local se Claude falhar
3. Monitore logs para erros de API

## Segurança

- API keys são armazenadas em memória apenas durante execução
- Webhook valida origem das mensagens
- Logs não expõem dados sensíveis dos usuários

## Suporte

Para problemas técnicos:
1. Verifique logs do servidor
2. Teste conexão com Evolution API
3. Confirme configuração do webhook
4. Use painel de administração para diagnóstico

## Integração com Telegram

O bot WhatsApp funciona em paralelo com o bot Telegram, compartilhando:
- Sistema de interpretação de datas
- Lógica de extração de títulos
- Geração de links de calendário
- Sistema de aprendizado

Ambos os bots podem ser usados simultaneamente sem conflitos.