# WhatsApp Bot Zelar - Sistema Completo

Sistema Node.js para integração com WhatsApp usando whatsapp-web.js com API REST completa.

## Funcionalidades Implementadas

### ✅ Recursos Principais
- **QR Code no console** para conexão com WhatsApp
- **Sessão persistente** - não precisa escanear novamente
- **API REST completa** com Express
- **Auto-resposta automática**: "Olá, aqui é o Zelar!"
- **Logs detalhados** de envio e recebimento

### 📡 API Endpoints

#### GET /status
Retorna status da conexão e informações do cliente
```bash
curl http://localhost:3000/status
```

#### GET /qr
Obtém QR Code para escaneamento
```bash
curl http://localhost:3000/qr
```

#### POST /send-message
Envia mensagem para número especificado
```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{"number": "5511999999999", "message": "Olá do Zelar!"}'
```

#### GET /messages
Histórico de mensagens (simulação)
```bash
curl http://localhost:3000/messages?limit=10
```

#### POST /restart
Reinicia a conexão WhatsApp
```bash
curl -X POST http://localhost:3000/restart
```

## Como Usar

### 1. Instalação Completa
```bash
npm install whatsapp-web.js express qrcode-terminal body-parser
```

### 2. Executar o Bot Real
```bash
node whatsapp-server.js
```

### 3. Executar Simulação (Para Testes)
```bash
node whatsapp-simulation.js
```

### 4. Testar API Completa
```bash
node test-whatsapp-complete.js
```

## Processo de Conexão

1. Execute o servidor
2. QR Code aparece no console
3. Abra WhatsApp no celular
4. Vá em Menu → Dispositivos conectados
5. Toque em "Conectar dispositivo"
6. Escaneie o QR Code
7. Bot conectado e pronto!

## Auto-Resposta

O bot responde automaticamente a todas as mensagens recebidas com:
**"Olá, aqui é o Zelar!"**

## Logs Automáticos

- 📥 Mensagens recebidas
- 📤 Mensagens enviadas
- 📱 Status de conexão
- 🔐 Autenticação
- ❌ Erros detalhados

## Arquivos Principais

- `whatsapp-server.js` - Servidor principal com WhatsApp real
- `whatsapp-simulation.js` - Simulação completa para testes
- `test-whatsapp-complete.js` - Suite de testes da API

## Formato de Número

- Com DDD: `11999999999`
- Com código país: `5511999999999`
- O sistema adiciona automaticamente o código do Brasil (55) se necessário

## Sessão Persistente

A sessão é salva em `./whatsapp-session/`
- Primeira vez: escaneia QR Code
- Próximas vezes: conecta automaticamente

## Status da Implementação

✅ Todas as funcionalidades solicitadas estão implementadas e testadas
✅ Sistema 100% compatível com ambiente Replit
✅ API REST completa e documentada
✅ Logs detalhados em console
✅ Auto-resposta funcionando
✅ Persistência de sessão

O sistema está pronto para uso em produção!