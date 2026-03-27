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

RUN npm install

COPY . .

RUN npm run build

RUN npm prune --production

CMD ["sh", "-c", "npm run db:migrate && npm run start:prod"]
