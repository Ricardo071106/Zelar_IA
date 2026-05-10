/**
 * Telegram só inicia com opt-in explícito.
 * Sem TELEGRAM_BOT_ENABLED=true o polling não sobe (evita 409 e uso acidental).
 */
export function isTelegramBotEnabled(): boolean {
  if (process.env.DISABLE_TELEGRAM_BOT === 'true') {
    return false;
  }
  const v = process.env.TELEGRAM_BOT_ENABLED?.trim().toLowerCase();
  return v === 'true' || v === '1';
}
