# Sistema Zelar - Documentação Completa

## Status Atual: ✅ OPERACIONAL

### Sistemas Ativos

#### 1. Bot Telegram (Porta 5000)
- **Status**: Totalmente funcional
- **IA**: Claude Haiku integrado
- **Função**: Processamento de linguagem natural em português para criação de eventos
- **Comandos**: Aceita mensagens como "reunião sexta às 14h"
- **Database**: PostgreSQL com persistência de usuários e eventos

#### 2. Bot WhatsApp (Porta 3004)
- **Status**: Operacional com QR code estável
- **Função**: Auto-resposta "Olá, aqui é o Zelar!"
- **Conexão**: QR code gerado via biblioteca Baileys oficial
- **API**: Endpoints para envio de mensagens e status

### Como Usar

#### WhatsApp
1. Acesse: `curl http://localhost:3004/qr`
2. Escaneie o QR code mostrado
3. Bot responde automaticamente às mensagens

#### Telegram
1. Bot já está ativo no Telegram
2. Envie mensagens naturais em português
3. Sistema cria eventos automaticamente

### Endpoints Principais

#### WhatsApp (Porta 3004)
```bash
GET  /status           # Status da conexão
GET  /qr               # Obter QR code
POST /send-message     # Enviar mensagem
POST /generate-qr      # Gerar novo QR code
POST /reset            # Resetar sistema
```

#### Sistema Principal (Porta 5000)
```bash
GET  /api/events       # Listar eventos
POST /api/events       # Criar evento
GET  /api/users        # Listar usuários
```

### Arquivos Principais

- `whatsapp-stable.js` - Servidor WhatsApp estável
- `server/index.ts` - Servidor principal com Telegram
- `server/telegram/` - Lógica do bot Telegram
- `shared/schema.ts` - Schema do banco de dados

### Soluções Implementadas

#### Problema: "Não é possível conectar dispositivos"
**Solução**: Sistema estável com controle de timing e reset automático

#### Problema: QR codes não funcionais
**Solução**: Biblioteca Baileys oficial com geração única por timestamp

#### Problema: Perda de sessão
**Solução**: Persistência automática e reconexão inteligente

### Tecnologias

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL, Drizzle ORM
- **IA**: Anthropic Claude para processamento de linguagem
- **WhatsApp**: Baileys (biblioteca oficial)
- **Telegram**: Telegraf

### Estado dos Sistemas

✅ Telegram Bot - Funcionando  
✅ WhatsApp Bot - Funcionando  
✅ Database - Conectado  
✅ IA Claude - Integrada  
✅ API REST - Disponível  

O sistema está pronto para uso em produção.