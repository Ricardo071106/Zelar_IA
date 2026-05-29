/** Mensagem padrão quando Pluggy está desligado (custo / manutenção). */
export const PLUGGY_MAINTENANCE_MESSAGE =
  "Leitura automática do extrato (Pluggy) está desativada. Para marcar aulas pagas, envie o comprovante PIX (foto ou PDF) no WhatsApp.";

/**
 * Padrão: manutenção ativa. Para reativar Pluggy no servidor: PLUGGY_MAINTENANCE=false
 */
export function isPluggyInMaintenance(): boolean {
  const v = process.env.PLUGGY_MAINTENANCE?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}
