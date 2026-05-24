# Binário Ollama (mesmo motor do repositório ollama-main; build from-source no Render levaria horas)
FROM ollama/ollama:latest AS ollama

FROM node:20-slim

# Chrome (Puppeteer) + libs do Ollama + tesseract (OCR imagem)
RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
  && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  ffmpeg ca-certificates curl libgomp1 libopenblas0 libvulkan1 \
  tesseract-ocr tesseract-ocr-por tesseract-ocr-eng \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ollama /usr/bin/ollama /usr/local/bin/ollama
COPY --from=ollama /usr/lib/ollama /usr/lib/ollama

ENV LD_LIBRARY_PATH=/usr/lib/ollama
ENV PATH=/usr/local/bin:$PATH
ENV OLLAMA_HOST=127.0.0.1:11434
ENV OLLAMA_MODELS=/app/.ollama-models
ENV LLM_BASE_URL=http://127.0.0.1:11434/v1
ENV LLM_MODEL=qwen2.5:1.5b-instruct
ENV LLM_NUM_CTX=2048
ENV LLM_NUM_PREDICT=512
ENV OLLAMA_NUM_PARALLEL=1
ENV OLLAMA_MAX_LOADED_MODELS=1
ENV LLM_API_KEY=ollama
ENV OLLAMA_AUTO_PULL=true

WORKDIR /app

COPY package*.json ./

RUN npm config set fetch-retries 10 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set maxsockets 10 \
  && (npm install --no-audit --no-fund \
    || (echo "npm install retry 1..." && sleep 15 && npm install --no-audit --no-fund) \
    || (echo "npm install retry 2..." && sleep 30 && npm install --no-audit --no-fund))

COPY . .

RUN npm run build \
  && npm prune --production \
  && chmod +x /app/scripts/docker-entrypoint.sh

CMD ["/app/scripts/docker-entrypoint.sh"]
