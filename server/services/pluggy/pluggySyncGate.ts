/** Pausa conciliação Pluggy (webhook/buscar) durante agendamento em lote no WhatsApp. */
let pauseDepth = 0;

export function beginPluggySyncPause(): void {
  pauseDepth += 1;
}

export function endPluggySyncPause(): void {
  pauseDepth = Math.max(0, pauseDepth - 1);
}

export function isPluggySyncPaused(): boolean {
  return pauseDepth > 0;
}
