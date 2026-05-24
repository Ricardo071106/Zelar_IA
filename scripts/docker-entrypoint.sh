#!/bin/sh
set -e

OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
export OLLAMA_HOST
export OLLAMA_MODELS="${OLLAMA_MODELS:-/app/.ollama-models}"
mkdir -p "$OLLAMA_MODELS"

OLLAMA_BASE="http://${OLLAMA_HOST}"

echo "[entrypoint] Iniciando Ollama (${OLLAMA_HOST}, modelos em ${OLLAMA_MODELS})..."
ollama serve &
OLLAMA_PID=$!

echo "[entrypoint] Aguardando API do Ollama..."
ready=0
attempt=0
while [ "$attempt" -lt 90 ]; do
  if curl -sf "${OLLAMA_BASE}/api/tags" >/dev/null 2>&1; then
    ready=1
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$ready" -eq 0 ]; then
  echo "[entrypoint] AVISO: Ollama não respondeu a tempo — Zelar usará parser local (regex)."
else
  echo "[entrypoint] Ollama pronto."
  MODEL="${LLM_MODEL:-qwen2.5:3b-instruct}"
  if [ "${OLLAMA_AUTO_PULL:-true}" = "true" ] && [ -n "$MODEL" ]; then
    echo "[entrypoint] Garantindo modelo ${MODEL} (1ª vez pode demorar)..."
    if ! ollama pull "$MODEL"; then
      echo "[entrypoint] AVISO: falha no pull de ${MODEL}."
    fi
  fi
fi

echo "[entrypoint] Iniciando Zelar (migrate + server)..."
npm run db:migrate
exec npm run start:prod
