# Guia de Integração WhatsApp Business

## Como Conectar Seu WhatsApp Business

### 1. Executar o Bot Business
```bash
node whatsapp-business-bot.js
```

### 2. Escanear QR Code
1. Abra seu **WhatsApp Business** no celular
2. Vá em **Menu (⋮)** → **Dispositivos conectados**
3. Toque em **Conectar dispositivo**
4. Escaneie o QR Code exibido no terminal

### 3. Verificar Conexão
- Acesse: http://localhost:3001/business-info
- Confirme que `isBusiness: true`

## Diferenças WhatsApp Business vs Pessoal

### WhatsApp Business (Porta 3001)
- ✅ Perfil empresarial
- ✅ Mensagens automáticas personalizadas
- ✅ Catálogo de produtos
- ✅ Horário de funcionamento
- ✅ Estatísticas de mensagens

### WhatsApp Pessoal (Porta 3000)
- ✅ Uso pessoal
- ✅ Mensagens simples
- ✅ Grupos familiares/amigos

## APIs Disponíveis

### WhatsApp Business (Porta 3001)
```bash
# Status e informações Business
GET http://localhost:3001/status
GET http://localhost:3001/business-info

# Enviar mensagem Business
POST http://localhost:3001/send
{
  "number": "5511999999999",
  "message": "Mensagem da empresa"
}
```

### WhatsApp Pessoal (Porta 3000)
```bash
# Status pessoal
GET http://localhost:3000/status

# Enviar mensagem pessoal
POST http://localhost:3000/send
{
  "number": "5511999999999", 
  "message": "Mensagem pessoal"
}
```

## Recursos Business Exclusivos

1. **Perfil Empresarial**: Nome da empresa, descrição, categoria
2. **Mensagens Automáticas**: Respostas quando ausente
3. **Catálogo**: Exibir produtos e serviços
4. **Estatísticas**: Métricas de mensagens entregues/lidas
5. **Etiquetas**: Organizar conversas por categorias

## Comandos de Agenda Business

O bot Business entende comandos específicos para empresas:

- "Reunião com cliente amanhã às 14h"
- "Apresentação para diretoria sexta 10h"
- "Follow-up com prospects segunda 15h"
- "Workshop terça-feira 9h às 12h"

## Integração com Calendário Empresarial

O sistema cria automaticamente:
- Links para Google Workspace
- Integração com Outlook 365
- Convites para Microsoft Teams
- Eventos no Apple Calendar Business