# Render Deployment Guide

This guide explains how to deploy the Zelar IA application to [Render](https://render.com/).

## Prerequisites

- A Render account.
- This repository pushed to your GitHub.

## Deployment Steps

1.  **New Web Service**:
    - Go to your Render Dashboard.
    - Click **New +** > **Web Service**.
    - Connect your GitHub repository (`Zelar_IA`).

2.  **Configuration**:
    - Render should automatically detect the `render.yaml` file (Blueprint) if you select "New Blueprint Instance" or simply configure it manually.
    - **Runtime**: Select **Docker**.
    - **Region**: Choose the one closest to you (e.g., Oregon, Frankfurt).
    - **Branch**: `main`.

3.  **Environment Variables**:
    - If not using the Blueprint/render.yaml auto-setup, ensure you add the Environment Variables from your local `.env` file.
    - **Critical Variables for Puppeteer**:
        - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`: `true`
        - `PUPPETEER_EXECUTABLE_PATH`: `/usr/bin/google-chrome-stable`
    - **Other Variables**:
        - `DATABASE_URL`: Your production database connection string.
        - `NODE_ENV`: `production`
        - `WHATSAPP_AUTH_DIR`: `/opt/render/project/src/.whatsapp-auth` (for session persistence)
        - `RESTART_WEBHOOK_TOKEN`: secret token used by restart webhook
        - `RESTART_WEBHOOK_URL`: full URL for `POST /health/restart`

4.  **Database**:
    - Render provides managed PostgreSQL. You can create one and link it, or use an external provider (like Neon, Supabase, or Railway).

5.  **Deploy**:
    - Click **Create Web Service**.
    - Monitor the build logs. The Dockerfile will install Chrome dependencies automatically.

## Por que a landing “não muda” (análise)

### 1. O site em produção não lê `client/` direto

O fluxo é: **`client/index.html` + React** → **`npm run build` (Vite)** → **`dist/public/`** (HTML + `assets/*.js`). O Express serve **`dist/public`**, não a pasta `client/`.

Se o deploy **não rodar o build** ou usar **imagem/cache antigo**, o navegador continua recebendo o mesmo `dist/public/index.html` de antes.

### 2. `dist/public` não deve ir no Git

Artefato de build no Git tende a “congelar” uma versão velha. A fonte é `client/`; o **Dockerfile** já faz `RUN npm run build` após o `COPY`.

### 3. Cache do `index.html` (SPA)

Rotas que caem no fallback `app.get('*')` também devolvem `index.html`. O servidor aplica **`Cache-Control: no-store`** nesse HTML e `maxAge: 0` nos estáticos para reduzir HTML/SPA preso em cache.

### 4. Conferência nos logs do Render

Ao subir, procure no log:

`[zelar] Frontend estático: .../dist/public | <title> servido: "..."`

Esse `<title>` deve coincidir com o de `client/index.html` do commit deployado. Se ainda for título antigo, o **build da imagem** não incluiu o código novo ou o serviço não foi atualizado.

### 5. Runtime errado no Render

Se o Web Service **não** usar **Docker** (ex.: Node nativo sem `npm run build` no build command), `dist/public` pode não ser gerado. O `render.yaml` deste repo usa **`runtime: docker`**. Confira no painel: **Docker**, branch **`main`**, repositório [Ricardo071106/Zelar_IA](https://github.com/Ricardo071106/Zelar_IA).

### 6. Máquina local: `dist/` velho

Depois de editar `client/`, rode **`npm run build`** para regenerar `dist/public`. Um `npm start` sem build serve HTML antigo; o log do `<title>` ajuda a notar.

## Landing / front não atualizou após `git push`

1. No [Render Dashboard](https://dashboard.render.com), abra o serviço **zelar-ia** (ou o nome do seu Web Service).
2. Confirme que o **último deploy** corresponde ao commit certo (aba **Events** / **Logs**).
3. Use **Manual Deploy** → **Clear build cache & deploy** (ou equivalente). O `Dockerfile` roda `npm run build` e gera `dist/public` na imagem; cache antigo ou deploy que não rodou deixa o site velho.
4. No navegador, teste em aba anônima ou com hard refresh (o HTML da SPA costuma ser cacheado).

Não commite `dist/public` no Git: o build da Vite já recria essa pasta a partir de `client/`.

## Notes

- This setup uses a **Docker** environment to ensure all system dependencies for Puppeteer (Chrome) are present.
- The `Dockerfile` installs `google-chrome-stable` and fonts, so the bot can generate QR codes and render pages correctly.
- To persist WhatsApp login between restarts, attach a **Render Disk** and mount it to the same path configured in `WHATSAPP_AUTH_DIR`.
- For daily midnight restarts, use the cron service defined in `render.yaml`.
- The schedule is `0 3 * * *`, which corresponds to `00:00` in `America/Sao_Paulo` (UTC-3).
- Point `RESTART_WEBHOOK_URL` to:
  - `https://<your-service-domain>/health/restart`
  - with `Authorization: Bearer <RESTART_WEBHOOK_TOKEN>`
- Simpler option (without Render Cron): enable internal restart in the app:
  - `AUTO_RESTART_AT_MIDNIGHT=true`
  - `AUTO_RESTART_TZ=America/Sao_Paulo`
  - `AUTO_RESTART_CRON=0 0 * * *`
