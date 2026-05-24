#!/bin/sh
set -e

OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
export OLLAMA_HOST
export OLLAMA_MODELS="${OLLAMA_MODELS:-/app/.ollama-models}"
export OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL:-1}"
export OLLAMA_MAX_LOADED_MODELS="${OLLAMA_MAX_LOADED_MODELS:-1}"
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
  MODEL="${LLM_MODEL:-qwen2.5:1.5b-instruct}"
  if [ "${OLLAMA_AUTO_PULL:-true}" = "true" ] && [ -n "$MODEL" ]; then
    echo "[entrypoint] Garantindo modelo ${MODEL} (1ª vez pode demorar)..."
    if ollama pull "$MODEL"; then
      echo "[entrypoint] Testando se ${MODEL} cabe na RAM..."
      if ! ollama run "$MODEL" "responda ok" >/dev/null 2>&1; then
        FALLBACK="${LLM_MODEL_FALLBACK:-qwen2.5:0.5b-instruct}"
        if [ "$MODEL" != "$FALLBACK" ]; then
          echo "[entrypoint] AVISO: ${MODEL} não coube na RAM (${FALLBACK} será usado)."
          if ollama pull "$FALLBACK"; then
            export LLM_MODEL="$FALLBACK"
            MODEL="$FALLBACK"
          fi
        fi
      else
        echo "[entrypoint] Modelo ${MODEL} carregado com sucesso."
      fi
    else
      echo "[entrypoint] AVISO: falha no pull de ${MODEL}."
    fi
  fi
fi

echo "[entrypoint] Iniciando Zelar (migrate + server)..."
npm run db:migrate
exec npm run start:prod
