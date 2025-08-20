# 🎤 Configuração do OpenRouter para Transcrição de Áudio

## 📋 O que é o OpenRouter?

O OpenRouter é uma plataforma que oferece acesso a múltiplos modelos de IA, incluindo o Whisper da OpenAI para transcrição de áudio, por preços muito mais baixos.

## 💰 Vantagens de Preço

- **OpenAI direto**: ~$0.006 por minuto de áudio
- **OpenRouter**: ~$0.002 por minuto de áudio (66% mais barato!)

## 🔧 Como Configurar

### 1. Criar conta no OpenRouter
1. Acesse: https://openrouter.ai/
2. Faça login com GitHub ou Google
3. Vá em "API Keys" no menu lateral

### 2. Gerar API Key
1. Clique em "Create API Key"
2. Dê um nome como "Zelar Audio"
3. Copie a chave gerada

### 3. Configurar no Render
1. Vá para seu projeto no Render
2. Clique em "Environment"
3. Adicione a variável:
   ```
   OPENROUTER_API_KEY = sua_chave_aqui
   ```

### 4. Deploy
1. Faça commit das mudanças
2. O Render fará deploy automaticamente
3. O sistema detectará a chave e usará o OpenRouter

## 🎯 Modelos Disponíveis

O OpenRouter oferece vários modelos de transcrição:

- **openai/whisper-1** (padrão)
- **anthropic/claude-3-sonnet**
- **google/gemini-pro**
- E muitos outros...

## 🔍 Verificar se está funcionando

Após o deploy, você verá no log:
```
✅ AudioService inicializado com OpenRouter
```

## 🚀 Testando

1. Envie uma mensagem de áudio no WhatsApp ou Telegram
2. O bot deve transcrever e processar automaticamente
3. Você verá logs como:
   ```
   🎤 Processando áudio...
   🔧 Usando modelo: openai/whisper-1
   ✅ Áudio transcrito: "marque uma reunião amanhã às 14h"
   ```

## 💡 Dicas

- O OpenRouter é muito mais barato que a OpenAI direta
- Funciona com todos os modelos de transcrição disponíveis
- Tem fallback automático se um modelo falhar
- Suporte a português brasileiro nativo

## 🆘 Troubleshooting

### Erro: "AudioService não disponível"
- Verifique se a `OPENROUTER_API_KEY` está configurada no Render
- Confirme se a chave está correta

### Erro: "Model not found"
- O sistema tentará automaticamente com modelo alternativo
- Se persistir, verifique se sua conta tem créditos

### Transcrição ruim
- Tente falar mais claramente
- Evite ruído de fundo
- Use frases completas

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs no Render
2. Confirme se a API key está ativa
3. Teste com áudio de boa qualidade 