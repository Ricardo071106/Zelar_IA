# Troubleshooting - Problemas com Áudio

## 🔍 Diagnóstico de Problemas

### 1. Verificar Configuração
O bot deve mostrar no console:
- ✅ `🎤 AudioService inicializado com sucesso` (se configurado)
- ⚠️ `⚠️ AudioService não disponível` (se não configurado)

### 2. Verificar Variáveis de Ambiente
Certifique-se de que uma das seguintes variáveis está configurada no `.env`:

```env
# Opção 1 - OpenRouter (recomendado)
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# OU Opção 2 - OpenAI direto
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Logs de Debug Adicionados
Agora o bot mostra logs detalhados:

```
🔍 Verificando tipo de mensagem:
📝 Text: false
🎤 Voice: true
🎵 Audio: false
🎤 AudioService disponível: true
🎤 Mensagem de voz recebida
📁 Voice file_id: AwADBAAD...
📥 Baixando arquivo de áudio...
📁 File info: { file_id: '...', file_path: '...' }
🔗 Audio URL: https://api.telegram.org/file/bot...
⬇️ Fazendo download do arquivo...
📊 Response status: 200
📦 Audio buffer size: 12345 bytes
🎵 Iniciando transcrição...
🎤 Iniciando transcrição de áudio...
✅ Transcrição concluída: "texto transcrito"
```

## 🚨 Problemas Comuns

### Problema 1: "AudioService não disponível"
**Sintomas**: Bot não processa áudio
**Solução**: Configure a variável de ambiente

### Problema 2: "Erro ao baixar arquivo"
**Sintomas**: Erro 404 ou 403
**Causa**: Token do Telegram inválido
**Solução**: Verificar `TELEGRAM_BOT_TOKEN`

### Problema 3: "Erro na transcrição"
**Sintomas**: Erro da API OpenAI/OpenRouter
**Causa**: API key inválida ou sem crédito
**Solução**: Verificar API key e créditos

### Problema 4: "Mensagem sem texto e sem áudio"
**Sintomas**: Bot não detecta mensagem de voz
**Causa**: Problema na detecção do tipo de mensagem
**Solução**: Verificar logs de debug

## 🧪 Teste Passo a Passo

### 1. Teste de Configuração
Envie uma mensagem de texto normal:
```
"teste"
```
**Resultado esperado**: Bot responde normalmente

### 2. Teste de Áudio
Envie uma mensagem de voz simples:
```
"oi"
```
**Resultado esperado**: 
- Logs de debug aparecem
- Transcrição é feita
- Bot responde em áudio

### 3. Teste de Fallback
Se o áudio falhar, o bot deve:
- Mostrar erro nos logs
- Responder em texto
- Explicar o problema

## 📊 Logs para Verificar

### Logs de Inicialização
```
🎤 AudioService inicializado com sucesso
```

### Logs de Mensagem de Voz
```
🎤 Mensagem de voz recebida
📁 Voice file_id: [ID do arquivo]
📥 Baixando arquivo de áudio...
📁 File info: [Informações do arquivo]
🔗 Audio URL: [URL do arquivo]
⬇️ Fazendo download do arquivo...
📊 Response status: 200
📦 Audio buffer size: [Tamanho em bytes]
🎵 Iniciando transcrição...
🎤 Iniciando transcrição de áudio...
✅ Transcrição concluída: "[texto]"
```

### Logs de Erro
```
❌ Erro ao processar voz: [detalhes do erro]
❌ Error details: [mensagem específica]
```

## 🔧 Soluções Rápidas

### Se não funcionar:
1. **Verifique os logs** no console do servidor
2. **Configure a API key** corretamente
3. **Teste com mensagem de texto** primeiro
4. **Envie uma mensagem de voz simples** ("oi")
5. **Verifique se há crédito** na conta OpenRouter/OpenAI

### Se ainda não funcionar:
1. **Reinicie o servidor**
2. **Verifique se o deploy foi aplicado**
3. **Teste localmente** se possível
4. **Verifique a conectividade** com as APIs

## 📞 Próximos Passos

Se o problema persistir:
1. Compartilhe os logs de debug
2. Verifique se a API key está correta
3. Teste com uma mensagem de voz simples
4. Verifique se há crédito disponível

---
**Status**: Debug implementado, aguardando logs! 🔍
