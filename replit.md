# Zelar - AI-Powered Telegram Scheduling Assistant

## Overview

Zelar is a comprehensive multi-platform scheduling assistant with intelligent AI-powered natural language processing. The system provides dual bot integration through Telegram and WhatsApp, processing Brazilian Portuguese text to create calendar events and manage appointments. Built with Node.js, Express, and featuring a modern React frontend with TypeScript, plus PostgreSQL database integration using Drizzle ORM.

### Current Status
- **Telegram Bot**: ✅ FUNCIONANDO - Bot @zelar_assistente_bot ativo com Claude AI integration
- **WhatsApp Bot**: Configurado com ZAPI integration e botão flutuante no site
- **Database**: PostgreSQL com user management e event storage completos
- **Frontend**: React interface para monitoramento do sistema

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
- **WhatsApp Integration**: Multiple implementations including whatsapp-web.js and Baileys

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

2. **WhatsApp Integration (`whatsapp-*.js`)**
   - Multiple WhatsApp Web implementations
   - QR code authentication
   - Message processing and auto-response
   - Business account support

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

1. **User Input**: Users send natural language messages via Telegram or WhatsApp
2. **Message Processing**: Bot receives message and extracts event information
3. **Date Parsing**: Advanced date/time parsing handles Brazilian Portuguese expressions
4. **Event Creation**: System creates event in database with proper timezone handling
5. **Calendar Sync**: Event is synchronized with user's preferred calendar application
6. **Confirmation**: User receives confirmation with event details

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL with connection pooling
- **Bot Platforms**: Telegram Bot API, WhatsApp Web APIs
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
- **Port 3004**: WhatsApp Bot server with stable QR code system
- **Port 5000**: Telegram Bot and main application server

## Changelog

- June 23, 2025. Initial setup with Telegram bot and Claude AI integration
- June 23, 2025. WhatsApp integration completed using Baileys library with real QR code generation
- June 23, 2025. Implemented stable WhatsApp system to resolve "device connection" errors
- June 23, 2025. Both Telegram and WhatsApp bots fully operational with auto-response capabilities

## Recent Changes

### SOLUÇÃO TELEGRAM BOT (Julho 2025)
- ✅ RESOLVIDO: Conflito 409 "multiple getUpdates requests" que impedia inicialização
- ✅ IMPLEMENTADO: Bot direto usando API Telegram ao invés de Telegraf polling
- ✅ FUNCIONANDO: Bot @zelar_assistente_bot respondendo mensagens em tempo real
- ✅ INTEGRADO: Claude AI para interpretação inteligente de eventos em português
- ✅ OPERACIONAL: Criação automática de eventos com links para Google Calendar e Outlook

### Sistema Funcional Completo
- **Telegram Bot**: Funcionando 100% - processamento de linguagem natural brasileira
- **WhatsApp Integration**: Sistema fallback implementado com diagnóstico completo
- **AI Processing**: Claude interpretação unificada para ambas plataformas
- **Database**: PostgreSQL com gestão completa de usuários e eventos
- **Calendar Integration**: Links diretos para Google Calendar e Outlook

### Solução WhatsApp Inteligente (Julho 2025)
- ✅ CORRIGIDO: Bot WhatsApp com mesma IA do Telegram agora funcionando
- ✅ IMPLEMENTADO: Endpoint /api/whatsapp/test-message processando corretamente
- ✅ FUNCIONANDO: Interpretação inteligente usando Claude AI idêntica ao Telegram
- ✅ OPERACIONAL: Criação automática de eventos com links para calendário
- ✅ TESTADO: Sistema validado processando "Reunião com cliente amanhã às 14h"

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