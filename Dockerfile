FROM node:20-slim

# Chrome + fonts (Puppeteer); ffmpeg/whisper/tesseract para mídia WhatsApp
RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
  && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  ffmpeg build-essential git ca-certificates curl libgomp1 \
  tesseract-ocr tesseract-ocr-por tesseract-ocr-eng \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch v1.5.4 https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp \
  && make -C /tmp/whisper.cpp -j"$(nproc)" \
  && install -m 755 /tmp/whisper.cpp/main /usr/local/bin/whisper-cli \
  && mkdir -p /opt/whisper-models \
  && cd /tmp/whisper.cpp && bash ./models/download-ggml-model.sh base \
  && cp /tmp/whisper.cpp/models/ggml-base.bin /opt/whisper-models/ggml-base.bin \
  && rm -rf /tmp/whisper.cpp

ENV WHISPER_CLI_PATH=/usr/local/bin/whisper-cli
ENV WHISPER_MODEL_PATH=/opt/whisper-models/ggml-base.bin

WORKDIR /app

COPY package*.json ./

# npm install (não npm ci): o lock gerado em outro npm às vezes falha EUSAGE no Node 20 do Docker
# (peers picomatch/express-handlebars). Install resolve a árvore no build; retries cobrem ECONNRESET.
RUN npm config set fetch-retries 10 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set maxsockets 10 \
  && (npm install --no-audit --no-fund \
    || (echo "npm install retry 1..." && sleep 15 && npm install --no-audit --no-fund) \
    || (echo "npm install retry 2..." && sleep 30 && npm install --no-audit --no-fund))

COPY . .

RUN npm run build

RUN npm prune --production

CMD ["sh", "-c", "npm run db:migrate && npm run start:prod"]
