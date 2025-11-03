# 🗄️ Inicialização do Banco de Dados

Este guia explica como configurar e inicializar o banco de dados PostgreSQL para o projeto Zelar.

## 📋 Pré-requisitos

1. Banco de dados PostgreSQL criado (recomendado: [Neon](https://neon.tech))
2. Arquivo `.env` configurado com `DATABASE_URL`

## 🚀 Métodos de Inicialização

### Método 1: Script Direto (Recomendado para primeira vez)

Este método cria as tabelas diretamente no banco usando SQL:

```bash
npm run db:init
```

**O que este script faz:**
- ✅ Testa a conexão com o banco
- ✅ Cria tabela `users`
- ✅ Cria tabela `events` com índices
- ✅ Cria tabela `user_settings`
- ✅ Mostra estatísticas das tabelas criadas

**Saída esperada:**
```
🔧 Iniciando configuração do banco de dados...

📡 Testando conexão com o banco...
✅ Conexão estabelecida com sucesso!

📋 Criando tabela "users"...
✅ Tabela "users" criada!

📋 Criando tabela "events"...
✅ Tabela "events" criada!

📋 Criando índices na tabela "events"...
✅ Índices criados!

📋 Criando tabela "user_settings"...
✅ Tabela "user_settings" criada!

📊 Tabelas no banco de dados:
   ✅ events
   ✅ user_settings
   ✅ users

📈 Contagem de registros:
   👥 Users: 0
   📅 Events: 0
   ⚙️  Settings: 0

✅ Banco de dados inicializado com sucesso! 🎉
```

---

### Método 2: Drizzle Kit Push (Alternativo)

Este método usa o Drizzle Kit para sincronizar o schema:

```bash
npm run db:push
```

**Vantagens:**
- Sincroniza automaticamente com o schema TypeScript
- Detecta diferenças e aplica mudanças
- Ideal para desenvolvimento

---

### Método 3: Migrations (Para produção)

Para produção, use o sistema de migrations:

#### Passo 1: Gerar migration
```bash
npm run db:generate
```

Isso cria arquivos SQL em `./migrations/` baseados no schema.

#### Passo 2: Aplicar migration
```bash
npm run db:migrate
```

Isso executa as migrations pendentes no banco.

---

## 🔍 Verificar o Banco

### Drizzle Studio (Interface Visual)

Abra uma interface web para visualizar e editar dados:

```bash
npm run db:studio
```

Acesse: `https://local.drizzle.studio`

---

## 📊 Estrutura das Tabelas

### Tabela: `users`
```sql
- id (SERIAL PRIMARY KEY)
- username (TEXT UNIQUE) - Telegram ID ou WhatsApp número
- password (TEXT) - Hash ou placeholder
- telegram_id (TEXT UNIQUE) - ID do Telegram
- name (TEXT) - Nome do usuário
- email (TEXT) - Email (opcional)
- created_at (TIMESTAMP) - Data de criação
```

### Tabela: `events`
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER) - FK para users
- title (TEXT) - Título do evento
- description (TEXT) - Descrição
- start_date (TIMESTAMP) - Data/hora de início
- end_date (TIMESTAMP) - Data/hora de término
- location (TEXT) - Local
- is_all_day (BOOLEAN) - Evento o dia todo
- calendar_id (TEXT) - ID no Google/Apple Calendar
- conference_link (TEXT) - Link de videoconferência
- created_at (TIMESTAMP) - Data de criação
- updated_at (TIMESTAMP) - Última atualização
- raw_data (JSONB) - Dados originais (mensagem + parser)
```

**Índices:**
- `idx_events_user_id` - Performance em queries por usuário
- `idx_events_start_date` - Performance em queries por data

### Tabela: `user_settings`
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER UNIQUE) - FK para users
- notifications_enabled (BOOLEAN) - Lembretes ativados
- reminder_times (INTEGER[]) - Horas antes do evento [12, 1]
- calendar_provider (VARCHAR) - google, apple
- google_tokens (TEXT) - Tokens OAuth Google (JSON)
- apple_tokens (TEXT) - Tokens OAuth Apple (JSON)
- language (VARCHAR) - pt-BR, en-US
- time_zone (VARCHAR) - America/Sao_Paulo
- updated_at (TIMESTAMP) - Última atualização
```

---

## 🛠️ Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run db:init` | **Inicialização rápida** - Cria todas as tabelas |
| `npm run db:push` | Sincroniza schema com banco (dev) |
| `npm run db:generate` | Gera arquivos de migration |
| `npm run db:migrate` | Aplica migrations pendentes |
| `npm run db:studio` | Abre interface visual |

---

## ❓ Solução de Problemas

### Erro: "DATABASE_URL não configurado"

Certifique-se de que o arquivo `.env` existe com:
```env
DATABASE_URL=postgresql://user:password@host/database
```

### Erro: "relation already exists"

As tabelas já existem. Você pode:
1. Deletar as tabelas manualmente
2. Usar `db:push` para sincronizar
3. Ignorar se já estão corretas

### Erro de conexão

Verifique:
- URL do banco está correta
- Banco está acessível (firewall, IP whitelist)
- Credenciais estão corretas

---

## 📝 Notas Importantes

1. **Primeira vez:** Use `npm run db:init`
2. **Desenvolvimento:** Use `npm run db:push` para mudanças rápidas
3. **Produção:** Sempre use migrations (`db:generate` + `db:migrate`)
4. **Backup:** Faça backup antes de rodar migrations em produção

---

## 🎯 Próximos Passos

Após inicializar o banco:

1. Inicie o servidor: `npm run start`
2. Os bots criarão usuários automaticamente
3. Eventos serão salvos conforme forem criados
4. Use `/eventos` no Telegram para listar eventos

---

**💡 Dica:** Use `npm run db:studio` para visualizar os dados em tempo real enquanto testa os bots!
