# Zelar App

## Build e Deploy na AWS

### Pré-requisitos
- Node.js 18+
- Variáveis de ambiente configuradas (ex: `DATABASE_URL`)

### Passos para Deploy (Elastic Beanstalk)

1. Faça upload do código para o Elastic Beanstalk (zip ou git push).
2. No painel da AWS, configure as variáveis de ambiente necessárias (ex: `DATABASE_URL`).
3. O Elastic Beanstalk irá rodar automaticamente:
   - `npm install --include=dev` (instala dependências de desenvolvimento)
   - `npm run build` (build do frontend e backend)
   - `npm prune --omit=dev` (remove dependências de desenvolvimento)
   - `npm run start` (inicia o servidor)
4. O backend irá servir o frontend buildado em `/dist/public`.

### Scripts principais
- `npm run build` — Faz o build do frontend (Vite) e bundle do backend (esbuild)
- `npm run start` — Sobe o servidor Express em produção
- `npm run dev` — Ambiente de desenvolvimento

### Observações
- O build do frontend é feito a partir da pasta `client/` e sai em `dist/public`.
- O backend serve arquivos estáticos do frontend automaticamente em produção.
- Certifique-se de configurar corretamente as variáveis de ambiente no painel da AWS.

---

Dúvidas? Abra uma issue ou consulte a documentação da AWS para Node.js/Elastic Beanstalk. 