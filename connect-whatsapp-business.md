# Como Conectar Seu WhatsApp Business ao Sistema Zelar

## Passo a Passo Completo

### 1. Executar o Bot WhatsApp Business
```bash
node whatsapp-business-bot.js
```

### 2. Aguardar o QR Code
O sistema irá gerar um QR Code específico para WhatsApp Business. Você verá no terminal:
```
🚀 Iniciando WhatsApp Business Bot Zelar...
📱 Configurado para contas WhatsApp Business
🔗 QR Code gerado! Escaneie com seu WhatsApp Business:
```

### 3. Conectar Pelo WhatsApp Business
1. Abra o aplicativo **WhatsApp Business** no seu celular
2. Vá em **Menu (⋮)** → **Dispositivos conectados**  
3. Toque em **Conectar dispositivo**
4. Escaneie o QR Code exibido no terminal

### 4. Verificar Conexão Business
Após conectar, o sistema detectará automaticamente se é uma conta Business:
```
✅ WhatsApp Business conectado com sucesso!
🏢 Conta WhatsApp Business detectada!
🏪 Nome da empresa: [Nome da sua empresa]
```

### 5. Testar Funcionamento
Acesse: http://localhost:3001/business-info
```json
{
  "success": true,
  "business": {
    "isBusiness": true,
    "businessProfile": {...},
    "pushname": "Sua Empresa",
    "number": "5511999999999"
  }
}
```

## Recursos Exclusivos do WhatsApp Business

### Perfil Empresarial
- Nome da empresa visível
- Descrição do negócio
- Categoria da empresa
- Endereço e horário de funcionamento

### Mensagens Automáticas
O bot responde automaticamente com:
```
🏢 Olá! Bem-vindo ao Zelar Business!

Sou seu assistente inteligente para agendamentos. Posso ajudar você a:

📅 Criar eventos - "Reunião amanhã às 14h"
🔔 Configurar lembretes - "Lembrar consulta sexta 10h" 
📋 Gerenciar agenda - "/agenda"
🗓️ Links diretos para Google Calendar e Outlook

Como posso ajudar sua empresa hoje?
```

### APIs Específicas Business

#### Status Business
```bash
GET http://localhost:3001/status
GET http://localhost:3001/business-info
```

#### Enviar Mensagem Business
```bash
POST http://localhost:3001/send
Content-Type: application/json

{
  "number": "5511999999999",
  "message": "Reunião da diretoria sexta-feira às 14h"
}
```

## Comparação: Pessoal vs Business

| Recurso | WhatsApp Pessoal | WhatsApp Business |
|---------|------------------|-------------------|
| **Porta** | 3000 | 3001 |
| **Perfil** | Pessoal | Empresarial |
| **Catálogo** | ❌ | ✅ |
| **Estatísticas** | ❌ | ✅ |
| **Mensagens Auto** | Simples | Personalizadas |
| **Horário Funcionamento** | ❌ | ✅ |

## Uso Empresarial

### Comandos de Agenda Business
- "Apresentação para investidores terça às 15h"
- "Workshop de treinamento quinta 9h às 17h"
- "Reunião de resultados segunda 10h"
- "Call com cliente internacional sexta 8h"

### Integração Calendário Corporativo
- Google Workspace
- Microsoft 365 / Outlook
- Apple Calendar Business
- Convites automáticos para equipe

## Dashboard Unificado

Acesse http://localhost:5000/dashboard para:
- Status de ambos os WhatsApp (Pessoal + Business)
- Envio de mensagens para cada conta
- QR Codes separados quando necessário
- Testes completos de funcionalidade

## Solução de Problemas

### QR Code não aparece
```bash
# Verificar se o processo está rodando
ps aux | grep whatsapp-business-bot

# Reiniciar se necessário
pkill -f whatsapp-business-bot
node whatsapp-business-bot.js
```

### Erro "Não é conta Business"
- Certifique-se de usar o aplicativo WhatsApp Business
- Não o WhatsApp comum
- Se necessário, migre sua conta para Business

### Conexão perdida
O sistema salva a sessão em `./whatsapp-business-session/`
- Não precisa escanear QR toda vez
- Reconecta automaticamente

## Múltiplas Contas

Você pode usar simultaneamente:
1. **WhatsApp Pessoal** (porta 3000) - para uso pessoal
2. **WhatsApp Business** (porta 3001) - para sua empresa
3. **Telegram** - também funciona paralelamente

Todos com o mesmo processamento inteligente de eventos em português brasileiro.