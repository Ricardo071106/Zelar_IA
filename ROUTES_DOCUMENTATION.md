# 📚 Documentação de Rotas - Zelar IA API

## 🎯 Padrões Implementados

### Estrutura de Resposta Padronizada

Todas as respostas seguem o padrão:

**Sucesso:**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-11-03T00:00:00.000Z"
}
```

**Erro:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem de erro",
    "details": { ... }
  },
  "timestamp": "2025-11-03T00:00:00.000Z"
}
```

### Códigos de Erro Padronizados

| Código | Status HTTP | Descrição |
|--------|-------------|-----------|
| `VALIDATION_ERROR` | 400 | Erro de validação de dados |
| `UNAUTHORIZED` | 401 | Não autorizado |
| `FORBIDDEN` | 403 | Acesso negado |
| `RESOURCE_NOT_FOUND` | 404 | Recurso não encontrado |
| `ROUTE_NOT_FOUND` | 404 | Rota não encontrada |
| `CONFLICT` | 409 | Conflito de dados |
| `INTERNAL_SERVER_ERROR` | 500 | Erro interno do servidor |
| `SERVICE_UNAVAILABLE` | 503 | Serviço indisponível |

---

## 📋 Endpoints Disponíveis

### 🏥 Health Check

#### `GET /health`
Health check básico da aplicação.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 3600,
    "timestamp": "2025-11-03T00:00:00.000Z",
    "environment": "development",
    "services": {
      "telegram": true,
      "whatsapp": true,
      "database": true,
      "ai": true
    }
  }
}
```

#### `GET /health/detailed`
Health check detalhado com status de todos os serviços.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-11-03T00:00:00.000Z",
    "services": {
      "telegram": {
        "status": "healthy",
        "details": "Bot conectado",
        "botUsername": "@zelar_assistente_bot",
        "responseTime": 150
      },
      "whatsapp": {
        "status": "healthy",
        "details": "Conectado",
        "provider": "Baileys",
        "responseTime": 200
      },
      "database": {
        "status": "healthy",
        "details": "Conectado",
        "provider": "PostgreSQL (Neon)",
        "responseTime": 50
      },
      "ai": {
        "status": "healthy",
        "details": "API disponível",
        "provider": "Claude Haiku / OpenRouter",
        "responseTime": 800
      }
    },
    "system": {
      "uptime": 3600,
      "memory": { ... },
      "platform": "linux",
      "nodeVersion": "v18.0.0"
    }
  }
}
```

---

### 📱 WhatsApp

#### `GET /api/whatsapp/qr`
Obter QR code para autenticação do WhatsApp.

**Resposta (QR Code disponível):**
```json
{
  "success": true,
  "data": {
    "status": "qr_ready",
    "message": "Escaneie o QR code com seu WhatsApp",
    "qrCode": "2@...",
    "qrImage": "data:image/png;base64,..."
  }
}
```

**Resposta (Já conectado):**
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "message": "WhatsApp já está conectado",
    "clientInfo": {
      "pushname": "Nome do Usuário",
      "platform": "android"
    }
  }
}
```

#### `GET /api/whatsapp/status`
Obter status atual da conexão do WhatsApp.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "isConnected": true,
    "hasQrCode": false,
    "clientInfo": {
      "pushname": "Nome do Usuário",
      "platform": "android"
    },
    "timestamp": "2025-11-03T00:00:00.000Z"
  }
}
```

#### `POST /api/whatsapp/send`
Enviar mensagem via WhatsApp.

**Request Body:**
```json
{
  "to": "5511999999999",
  "message": "Olá, esta é uma mensagem de teste!"
}
```

**Validação:**
- `to`: string, mínimo 10 caracteres
- `message`: string, não pode estar vazio

**Resposta (Sucesso):**
```json
{
  "success": true,
  "data": {
    "message": "Mensagem enviada com sucesso",
    "to": "5511999999999",
    "sentAt": "2025-11-03T00:00:00.000Z"
  }
}
```

**Resposta (Erro - WhatsApp desconectado):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "WhatsApp não está conectado",
    "details": {
      "hasQrCode": true
    }
  },
  "timestamp": "2025-11-03T00:00:00.000Z"
}
```

---

### 📊 Analytics

#### `GET /api/analytics/overview`
Visão geral das métricas de analytics (dados mockados).

**Resposta:**
```json
{
  "success": true,
  "data": {
    "totals": {
      "users": 128,
      "netNewUsers30d": 38,
      "activeChats": 71,
      "eventsCreated": 312
    },
    "businessMetrics": [
      { "label": "Reuniões agendadas", "value": 142 },
      { "label": "Follow-ups ativos", "value": 68 }
    ],
    "funnel": [
      { "stage": "Mensagens recebidas", "value": 1040 },
      { "stage": "Mensagens compreendidas", "value": 872 }
    ],
    "automation": {
      "smartParserSuccess": 0.82,
      "aiFallbackUsage": 0.31,
      "calendarLinkClicks": 0.74,
      "averageAiLatencyMs": 860
    },
    "updatedAt": "2025-11-03T00:00:00.000Z"
  }
}
```

#### `GET /api/analytics/messages`
Exemplos de mensagens processadas.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "text": "agendar call de onboarding com Maria na terça 10h",
        "detectedIntent": "Onboarding",
        "channels": ["Telegram"],
        "timestamp": "2025-09-25T13:40:00Z"
      }
    ],
    "total": 4
  }
}
```

---

### 🏠 Root

#### `GET /`
Informações básicas da API.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "message": "Zelar AI API está online!",
    "version": "2.0.0",
    "timestamp": "2025-11-03T00:00:00.000Z",
    "endpoints": {
      "health": "/health",
      "healthDetailed": "/health/detailed",
      "analytics": "/api/analytics/overview",
      "whatsapp": "/api/whatsapp/status"
    }
  }
}
```

---

## 🛠️ Middleware Implementados

### 1. Error Handler
Tratamento global de erros com suporte para:
- Erros personalizados (`AppError`)
- Erros de validação Zod
- Erros genéricos

### 2. Request Validator
Validação de requisições usando Zod schemas.

**Exemplo de uso:**
```typescript
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';

const schema = z.object({
  body: z.object({
    name: z.string().min(3),
    email: z.string().email(),
  }),
});

router.post('/users', validateRequest(schema), async (req, res) => {
  // req.body já validado
});
```

### 3. Async Handler
Wrapper para tratamento automático de erros em rotas assíncronas.

**Exemplo:**
```typescript
import { asyncHandler } from '../middleware/errorHandler';

router.get('/users', asyncHandler(async (req, res) => {
  // Erros são automaticamente capturados e enviados para o errorHandler
  const users = await getUsers();
  res.json({ success: true, data: users });
}));
```

---

## 📁 Estrutura de Arquivos

```
server/
├── middleware/
│   ├── errorHandler.ts      # Tratamento de erros global
│   └── validateRequest.ts   # Validação com Zod
├── routes/
│   ├── health.routes.ts     # Rotas de health check
│   ├── whatsapp.routes.ts   # Rotas do WhatsApp
│   └── analytics.routes.ts  # Rotas de analytics
├── routes.ts                # Registro central de rotas
└── index.ts                 # Entry point do servidor
```

---

## 🔄 Migrações Realizadas

### ✅ Antes (routes.ts monolítico)
- Todas as rotas em um único arquivo (234 linhas)
- Tratamento de erros inconsistente
- Sem validação de entrada
- Códigos HTTP misturados
- Respostas não padronizadas

### ✅ Depois (modular e padronizado)
- Rotas organizadas por módulo
- Middleware de erro centralizado
- Validação com Zod
- Códigos de erro padronizados
- Respostas sempre com `success` + `data/error`
- Async handler para todas as rotas assíncronas

---

## 🎯 Próximos Passos Sugeridos

### 1. Adicionar mais rotas modulares
- `server/routes/telegram.routes.ts`
- `server/routes/events.routes.ts`
- `server/routes/users.routes.ts`
- `server/routes/payments.routes.ts` (Asaas)

### 2. Implementar autenticação
- Middleware de autenticação JWT
- Rate limiting por IP/usuário
- CORS configurável por ambiente

### 3. Documentação automática
- Integrar Swagger/OpenAPI
- Gerar docs automaticamente dos schemas Zod

### 4. Testes
- Testes unitários para cada rota
- Testes de integração
- Mock de serviços externos

---

## 📝 Exemplos de Uso

### Criar nova rota padronizada

```typescript
// server/routes/example.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Schema de validação
const createItemSchema = z.object({
  body: z.object({
    name: z.string().min(3),
    description: z.string().optional(),
  }),
});

// GET /api/example
router.get('/', asyncHandler(async (req, res) => {
  const items = await getItems();
  
  res.json({
    success: true,
    data: { items, total: items.length },
  });
}));

// POST /api/example
router.post(
  '/',
  validateRequest(createItemSchema),
  asyncHandler(async (req, res) => {
    const newItem = await createItem(req.body);
    
    res.status(201).json({
      success: true,
      data: newItem,
    });
  })
);

// GET /api/example/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const item = await getItemById(req.params.id);
  
  if (!item) {
    throw new NotFoundError('Item', req.params.id);
  }
  
  res.json({
    success: true,
    data: item,
  });
}));

export default router;
```

### Registrar nova rota no routes.ts

```typescript
import exampleRoutes from './routes/example.routes';

export async function registerRoutes(app: Express) {
  // ... outras rotas
  app.use('/api/example', exampleRoutes);
  // ...
}
```

---

**Documento atualizado em:** 03/11/2025  
**Versão da API:** 2.0.0
