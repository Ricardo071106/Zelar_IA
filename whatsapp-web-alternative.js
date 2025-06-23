// Alternative WhatsApp Business integration using web interface approach
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
app.use(express.static('public'));

// Store for business configuration
let businessConfig = {
    phoneNumber: null,
    businessName: null,
    isConfigured: false
};

// Store for simulated messages (for testing)
let testMessages = [];

// Business configuration endpoint
app.post('/api/business/configure', (req, res) => {
    const { phoneNumber, businessName } = req.body;
    
    if (!phoneNumber || !businessName) {
        return res.status(400).json({
            success: false,
            error: 'Número e nome da empresa são obrigatórios'
        });
    }

    businessConfig = {
        phoneNumber,
        businessName,
        isConfigured: true,
        configuredAt: new Date().toISOString()
    };

    res.json({
        success: true,
        message: 'Configuração salva com sucesso',
        whatsappLink: `https://wa.me/${phoneNumber}?text=${encodeURIComponent('Olá! Gostaria de agendar um evento usando o Zelar Assistant.')}`
    });
});

// Get business configuration
app.get('/api/business/config', (req, res) => {
    res.json({
        success: true,
        configuration: businessConfig.isConfigured ? businessConfig : null
    });
});

// Simulate message processing for testing
app.post('/api/whatsapp/simulate-message', (req, res) => {
    const { message, senderName } = req.body;
    
    const processedMessage = processEventMessage(message);
    
    testMessages.push({
        id: Date.now(),
        sender: senderName || 'Cliente Teste',
        message,
        response: processedMessage.response,
        timestamp: new Date().toISOString(),
        eventDetected: processedMessage.eventDetected
    });

    // Emit to connected clients
    io.emit('message_processed', {
        sender: senderName || 'Cliente Teste',
        message,
        response: processedMessage.response,
        eventDetected: processedMessage.eventDetected
    });

    res.json({
        success: true,
        response: processedMessage.response,
        eventDetected: processedMessage.eventDetected
    });
});

// Get test messages
app.get('/api/whatsapp/messages', (req, res) => {
    res.json({
        success: true,
        messages: testMessages.slice(-20) // Last 20 messages
    });
});

// Clear test messages
app.delete('/api/whatsapp/messages', (req, res) => {
    testMessages = [];
    res.json({ success: true, message: 'Mensagens limpas' });
});

// Process event message function
function processEventMessage(text) {
    const lowerText = text.toLowerCase();
    
    // Enhanced Portuguese event detection patterns
    const eventPatterns = [
        /(?:reunião|meeting|encontro|conferência)\s*(.+?)(?:\s+(?:às?|at|em)\s+(\d{1,2})(?::(\d{2}))?h?)?/i,
        /(?:consulta|appointment|visita)\s*(.+?)(?:\s+(?:às?|at|em)\s+(\d{1,2})(?::(\d{2}))?h?)?/i,
        /(?:evento|compromisso|atividade)\s*(.+?)(?:\s+(?:às?|at|em)\s+(\d{1,2})(?::(\d{2}))?h?)?/i,
        /(.+?)\s+(?:amanhã|tomorrow)\s+(?:às?|at)\s+(\d{1,2})(?::(\d{2}))?h?/i,
        /(.+?)\s+(?:segunda|monday|terça|tuesday|quarta|wednesday|quinta|thursday|sexta|friday|sábado|saturday|domingo|sunday)\s+(?:às?|at)?\s*(\d{1,2})(?::(\d{2}))?h?/i,
        /(.+?)\s+(?:hoje|today|amanhã|tomorrow)\s+(?:às?|at)?\s*(\d{1,2})(?::(\d{2}))?h?/i
    ];

    for (const pattern of eventPatterns) {
        const match = text.match(pattern);
        if (match) {
            const title = match[1] ? match[1].trim() : 'Evento';
            const hour = match[2] ? parseInt(match[2]) : 14;
            const minute = match[3] ? parseInt(match[3]) : 0;
            
            // Generate calendar links
            const eventTitle = encodeURIComponent(title);
            const eventDate = new Date();
            eventDate.setDate(eventDate.getDate() + 1); // Tomorrow by default
            eventDate.setHours(hour, minute, 0, 0);
            
            const endDate = new Date(eventDate);
            endDate.setHours(hour + 1, minute, 0, 0);
            
            const googleLink = generateGoogleCalendarLink(title, eventDate, endDate);
            const outlookLink = generateOutlookLink(title, eventDate, endDate);
            
            const response = `✅ *Evento detectado com sucesso!*

📅 *${title}*
🗓️ ${eventDate.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
})}
⏰ ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}

*Adicione ao seu calendário:*
🔗 Google Calendar: ${googleLink}
🔗 Outlook: ${outlookLink}

_Processado automaticamente pelo Zelar Assistant_`;

            return {
                eventDetected: true,
                response,
                eventDetails: {
                    title,
                    date: eventDate.toISOString(),
                    hour,
                    minute
                }
            };
        }
    }

    // No event detected - default response
    return {
        eventDetected: false,
        response: `Olá! 👋

Sou o *Zelar Assistant* - seu assistente inteligente para agendamentos.

Para criar um evento, envie uma mensagem como:
• "Reunião amanhã às 14h"
• "Consulta médica sexta-feira 10h"
• "Apresentação segunda 15h30"

Posso processar datas em português e criar links diretos para Google Calendar, Outlook e Apple Calendar.

Como posso ajudar você hoje?`
    };
}

function generateGoogleCalendarLink(title, startDate, endDate) {
    const formatDateForGoogle = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
        details: 'Evento criado pelo Zelar Assistant'
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function generateOutlookLink(title, startDate, endDate) {
    const params = new URLSearchParams({
        subject: title,
        startdt: startDate.toISOString(),
        enddt: endDate.toISOString(),
        body: 'Evento criado pelo Zelar Assistant'
    });
    
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Cliente conectado ao dashboard:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

const PORT = process.env.WHATSAPP_PORT || 3002;

server.listen(PORT, () => {
    console.log(`🚀 WhatsApp Business Alternative Server rodando na porta ${PORT}`);
    console.log(`📱 Acesse http://localhost:${PORT} para dashboard`);
    console.log('✅ Sistema pronto para processar mensagens');
});

export { businessConfig, processEventMessage };