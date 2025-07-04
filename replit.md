# Zelar - AI-Powered Telegram Scheduling Assistant

## Overview

Zelar is a comprehensive multi-platform scheduling assistant with intelligent AI-powered natural language processing. The system provides dual bot integration through Telegram and WhatsApp, processing Brazilian Portuguese text to create calendar events and manage appointments. Built with Node.js, Express, and featuring a modern React frontend with TypeScript, plus PostgreSQL database integration using Drizzle ORM.

### Current Status
- **Telegram Bot**: Fully operational with Claude AI integration for intelligent event parsing
- **WhatsApp Bot**: Operational with stable QR code system and auto-response capabilities
- **Database**: PostgreSQL with complete user management and event storage
- **Frontend**: React-based interface for system monitoring and management

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

### WhatsApp Integration via ZAPI
- Implemented ZAPI integration with user-provided credentials
- Created floating WhatsApp button on website that redirects to direct conversation
- Built intelligent webhook system using same Claude AI processing as Telegram
- Added automatic response system for WhatsApp messages with calendar event creation
- Configured endpoints for ZAPI connection, status checking, and webhook management

### Complete Bot Ecosystem
- Telegram bot (port 5000): Claude AI-powered natural language processing (@zelar_assistente_bot)
- WhatsApp bot: Direct conversation via floating button + automatic AI responses
- Website integration: Visitors can click WhatsApp button and get instant intelligent responses
- Database: PostgreSQL with complete user and event management
- Unified AI processing: Both platforms use identical Claude-powered event interpretation

## User Preferences

Preferred communication style: Simple, everyday language.