# Configuração de Áudio - Zelar Bot

## 🎤 Funcionalidades de Áudio

### ✅ Speech-to-Text (STT)
- Transcrever mensagens de voz do Telegram
- Suporte a arquivos de áudio
- Reconhecimento em português brasileiro

### ✅ Text-to-Speech (TTS)
- Respostas em áudio para o Telegram
- Voz natural em português
- Formato MP3 para compatibilidade

## 🔧 Configuração

### 1. Obter API Key
- **OpenRouter** (recomendado): [openrouter.ai](https://openrouter.ai) - $5 crédito gratuito
- **OpenAI**: [platform.openai.com](https://platform.openai.com) - precisa de crédito

### 2. Configurar Variável de Ambiente
Adicione no seu arquivo `.env`:

```env
# Para OpenRouter (recomendado)
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# OU para OpenAI direto
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Verificar Configuração
O bot mostrará no console:
- ✅ `🎤 AudioService inicializado com sucesso` (se configurado)
- ⚠️ `⚠️ AudioService não disponível` (se não configurado)

## 🚀 Como Usar

### Enviar Mensagem de Voz
1. Grave uma mensagem de voz no Telegram
2. Envie para o bot: "marque um almoço com o Fred sexta às 12h"
3. O bot transcreverá automaticamente
4. Processará o agendamento normalmente
5. Responderá em áudio com a confirmação

### Enviar Arquivo de Áudio
1. Envie um arquivo de áudio (MP3, OGG, etc.)
2. O bot transcreverá o conteúdo
3. Processará o agendamento normalmente
4. Responderá em áudio com a confirmação

## 💰 Custos

### OpenRouter (Gratuito)
- **$5 de crédito gratuito** mensal
- **1 minuto de voz**: ~$0.006
- **Resposta de 200 caracteres**: ~$0.003
- **Total por interação**: ~$0.009

## 🔍 Troubleshooting

### Erro: "AudioService não disponível"
**Solução**: Configure a variável `OPENROUTER_API_KEY` ou `OPENAI_API_KEY` no `.env`

### Erro: "Não consegui entender a mensagem de voz"
**Soluções**:
- Fale mais alto e claro
- Use português brasileiro
- Verifique se a API key está correta

### Erro: "Erro ao enviar resposta em áudio"
**Solução**: O bot fará fallback para texto automaticamente

## 📝 Exemplos

### Mensagem de Voz
```
🎤 "Oi Zelar, marca um almoço com o João amanhã às 12h e manda para joao@email.com"
```

### Resposta do Bot
```
🔊 [Áudio] "Evento agendado! Almoço com João amanhã às 12h. Links de calendário e email enviados."
```

## 🎯 Funcionalidades Avançadas

### Voz Personalizada
Para alterar a voz do TTS, edite em `server/audio-service.js`:

```javascript
voice: 'alloy', // Opções: alloy, echo, fable, onyx, nova, shimmer
```

### Idioma Personalizado
Para alterar o idioma do STT, edite em `server/audio-service.js`:

```javascript
language: 'pt', // Código do idioma (pt, en, es, etc.)
```

## 📊 Logs de Monitoramento

O bot registra todas as operações de áudio:
- 🎤 `Iniciando transcrição de áudio...`
- ✅ `Transcrição concluída: "texto transcrito"`
- 🔊 `Iniciando geração de áudio...`
- ✅ `Áudio gerado: /path/to/file.mp3`
- ✅ `Resposta em áudio enviada!`

---
**Status**: Funcionalidades de áudio implementadas! 🎤✨
