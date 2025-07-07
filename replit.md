# Zelar - AI-Powered Scheduling Assistant

## Overview

Zelar é um assistente inteligente de agendamento com processamento de linguagem natural em português brasileiro. O sistema oferece integração com Telegram, processando texto natural para criar eventos de calendário e gerenciar compromissos. Construído com Node.js, Express, React frontend com TypeScript, e integração com banco PostgreSQL usando Drizzle ORM.

### Current Status
- **Telegram Bot**: ✅ FUNCIONANDO - Bot @zelar_assistente_bot ativo com Claude AI integration
- **Database**: PostgreSQL com user management e event storage completos
- **Frontend**: React interface com monitoramento de sistema

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Radix UI primitives with custom theming

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API endpoints
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with database persistence
- **Bot Integration**: Telegraf for Telegram bot functionality


### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon Database
- **ORM**: Drizzle ORM with TypeScript schema definitions
- **Session Storage**: Database-persisted user sessions
- **File Storage**: Local file system for WhatsApp session data and calendar files

## Key Components

### Bot Services
1. **Telegram Bot (`server/telegram/`)**
   - Natural language processing for event creation
   - Date/time parsing with timezone support using Luxon
   - Calendar integration with Google Calendar and Apple Calendar
   - User management and settings persistence



### Core Features
1. **Event Management**
   - Natural language event parsing
   - Timezone-aware scheduling
   - Calendar synchronization
   - Event CRUD operations

2. **User Management**
   - Telegram ID-based authentication
   - User preferences and settings
   - Multi-platform support

3. **Calendar Integration**
   - ICS file generation
   - Email invites with calendar attachments
   - Google Calendar API integration
   - Universal calendar compatibility

## Data Flow

1. **User Input**: Users send natural language messages via Telegram
2. **Message Processing**: Bot receives message and extracts event information
3. **Date Parsing**: Advanced date/time parsing handles Brazilian Portuguese expressions
4. **Event Creation**: System creates event in database with proper timezone handling
5. **Calendar Sync**: Event is synchronized with user's preferred calendar application
6. **Confirmation**: User receives confirmation with event details

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL with connection pooling
- **Bot Platforms**: Telegram Bot API
- **Date Processing**: Luxon for timezone-aware date handling
- **Email Services**: Nodemailer with multiple transport options
- **AI Processing**: Anthropic Claude API for natural language processing

### Development Dependencies
- **Build Tools**: Vite, TypeScript, ESBuild
- **Testing**: Built-in test scripts for API validation
- **Development**: Hot reload, source maps, development banners

## Deployment Strategy

### Environment Configuration
- **Development**: Local development with hot reload
- **Production**: Autoscale deployment on Replit
- **Database**: Neon Database with connection string configuration
- **Secrets**: Environment variables for API keys and credentials

### Build Process
1. Frontend build using Vite
2. Backend build using ESBuild
3. Static asset compilation
4. Database migration execution

### Port Configuration
- **Port 3000**: Main application server (mapped to external 3000)
- **Port 3001**: Secondary services (mapped to external 3001)

- **Port 5000**: Telegram Bot and main application server

## Changelog

- June 23, 2025. Initial setup with Telegram bot and Claude AI integration
- June 23, 2025. Focus on Telegram bot with full AI integration

## Recent Changes

### LIMPEZA TOTAL DO CÓDIGO (Julho 2025)
- ✅ REMOVIDO: Todos os códigos WhatsApp do projeto
- ✅ DELETADO: Arquivos, pastas e rotas WhatsApp
- ✅ LIMPO: Documentação e referências WhatsApp
- ✅ ORGANIZADO: Estrutura focada exclusivamente no Telegram
- ✅ FUNCIONAL: Sistema Telegram 100% operacional

### ADIÇÃO WHATSAPP SIMPLES (Julho 2025)
- ✅ INSTALADO: whatsapp-web.js e qrcode-terminal
- ✅ CRIADO: Bot WhatsApp simples com respostas automáticas
- ✅ IMPLEMENTADO: API routes para controle do WhatsApp (/api/whatsapp/*)
- ✅ ADICIONADO: Interface frontend para controle do WhatsApp
- ✅ FUNCIONAL: Sistema dual Telegram + WhatsApp operacional

### SOLUÇÃO TELEGRAM BOT (Julho 2025)
- ✅ RESOLVIDO: Conflito 409 "multiple getUpdates requests" que impedia inicialização
- ✅ IMPLEMENTADO: Bot direto usando API Telegram ao invés de Telegraf polling
- ✅ FUNCIONANDO: Bot @zelar_assistente_bot respondendo mensagens em tempo real
- ✅ INTEGRADO: Claude AI para interpretação inteligente de eventos em português
- ✅ OPERACIONAL: Criação automática de eventos com links para Google Calendar e Outlook

### Sistema Funcional Completo
- **Telegram Bot**: Funcionando 100% - processamento de linguagem natural brasileira
- **AI Processing**: Claude AI integrado e operacional no Telegram
- **Database**: PostgreSQL com gestão completa de usuários e eventos
- **Calendar Integration**: Links diretos para Google Calendar e Outlook

### Correções Bot Telegram (Julho 2025)
- ✅ RESTAURADO: Comandos /timezone, /help com interface completa
- ✅ ADICIONADO: Mensagem de boas-vindas com informação de fuso horário
- ✅ ORGANIZADO: Fusos horários agrupados por região (eliminando duplicações)
- ✅ MELHORADO: Interface com 12 fusos principais cobrindo todo o mundo
- ✅ CORRIGIDO: Sistema de comandos completo restaurado e no menu do bot

### Sistema de Monitoramento Completo (Julho 2025)
- ✅ CRIADO: Dashboard administrativo em `/system` com monitoramento em tempo real
- ✅ IMPLEMENTADO: Sistema de health check para todos os componentes
- ✅ FUNCIONANDO: Verificação automática de Telegram, WhatsApp, Database e IA
- ✅ OPERACIONAL: Interface visual com status, métricas e alertas
- ✅ INTEGRADO: Navegação melhorada no header com acesso direto ao sistema

## User Preferences

Preferred communication style: Simple, everyday language.
Code organization: Manter apenas uma versão principal de cada bot, sem duplicações.
Focus: Sistema focado exclusivamente no Telegram que está 100% funcional para produção.
Architecture: Estrutura limpa sem códigos desnecessários ou funcionalidades não utilizadas.