# 🚀 Guia Rápido de Deploy na AWS

## ⚡ Deploy em 5 Minutos

### 1. Pré-requisitos
```bash
# Instalar EB CLI
pip install awsebcli

# Configurar AWS (se ainda não fez)
aws configure
```

### 2. Configurar Variáveis de Ambiente
```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar com suas configurações
nano .env
```

**OBRIGATÓRIO:**
- `DATABASE_URL` - URL do seu banco PostgreSQL
- `TELEGRAM_BOT_TOKEN` - Token do seu bot do Telegram
- `SESSION_SECRET` - Qualquer string secreta

### 3. Deploy Automatizado
```bash
# Executar script de deploy
./deploy-aws.sh
```

### 4. Configurar no AWS Console
1. Acesse: https://console.aws.amazon.com/elasticbeanstalk
2. Selecione seu ambiente
3. **Configuration** > **Software**
4. Adicione as variáveis do `.env`

### 5. Verificar Deploy
```bash
# Ver status
eb status

# Ver logs
eb logs --follow

# Acessar aplicação
curl http://seu-dominio.elasticbeanstalk.com/health
```

## 🔧 Comandos Úteis

```bash
# Deploy de atualizações
eb deploy

# Ver logs em tempo real
eb logs --follow

# SSH na instância
eb ssh

# Verificar saúde
eb health

# Listar ambientes
eb list

# Abrir no navegador
eb open
```

## 🆘 Troubleshooting

### Build Falha
```bash
# Verificar logs de build
eb logs --all

# Testar build local
npm run build
```

### Bot Não Responde
- Verifique `TELEGRAM_BOT_TOKEN` no AWS Console
- Teste o token localmente primeiro

### Erro de Banco
- Verifique `DATABASE_URL` no AWS Console
- Teste a conexão localmente

### Erro de Memória
```bash
# Aumentar tipo de instância
eb config
# Mude para t3.medium ou t3.large
```

## 📊 Monitoramento

### Health Check
```bash
curl http://seu-dominio.elasticbeanstalk.com/health
```

### Métricas AWS
- CPU, Memória, Disco
- Requests/minuto
- Tempo de resposta

### Logs Importantes
- `/var/log/nodejs/nodejs.log`
- `/var/log/eb-activity.log`

## 💰 Custos

**Estimativa mensal:**
- t3.small: $15-20
- Load Balancer: $20
- Storage: $5-10
- **Total: $40-50/mês**

## 🔄 Atualizações

```bash
# Deploy automático
./deploy-aws.sh

# Deploy manual
eb deploy

# Rollback se necessário
eb rollback
```

## 🎯 Próximos Passos

1. ✅ Deploy na AWS
2. 🔧 Configurar domínio personalizado
3. 🔒 Configurar HTTPS
4. 📊 Configurar monitoramento
5. 🔄 Configurar CI/CD

---

**Precisa de ajuda?** Verifique os logs ou consulte a documentação completa no README.md 