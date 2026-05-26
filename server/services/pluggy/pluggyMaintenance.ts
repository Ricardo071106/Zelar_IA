/** Mensagem padrão quando Pluggy está desligado para manutenção. */
export const PLUGGY_MAINTENANCE_MESSAGE =
  "Open Finance (Pluggy) em manutenção. Envie o comprovante PIX (foto ou PDF) no WhatsApp.";

/**
 * Padrão: manutenção ativa. Para reativar Pluggy no servidor: PLUGGY_MAINTENANCE=false
 */
export function isPluggyInMaintenance(): boolean {
  const v = process.env.PLUGGY_MAINTENANCE?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}
