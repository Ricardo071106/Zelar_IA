import { DateTime } from "luxon";
import schedule from "node-schedule";
import { storage } from "../../storage";
import { runPluggyBuscarReconciliation } from "./pluggyBuscarReconciliation";
import { isPluggyInMaintenance } from "./pluggyMaintenance";

let tickRunning = false;

function parseHm(hm: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

async function runScheduledBuscarForUser(userId: number): Promise<void> {
  const result = await runPluggyBuscarReconciliation(userId, { windowIndex: 0 });
  const summary = result.ok
    ? `OK: ${result.lessonsMarked} aula(s); ${result.txSeen} lançamento(s)`
    : `Erro: ${result.message.slice(0, 200)}`;
  await storage.updateUserSettings(userId, {
    pluggyAutoBuscarLastRunAt: new Date(),
    pluggyAutoBuscarLastSummary: summary.slice(0, 255),
  });
  console.log("[Pluggy/auto]", { userId, summary });
}

async function tickPluggyAutoBuscar(): Promise<void> {
  if (isPluggyInMaintenance()) return;
  if (tickRunning) return;
  tickRunning = true;
  try {
    const candidates = await storage.listPluggyAutoBuscarScheduleCandidates();
    if (!candidates.length) return;

    for (const row of candidates) {
      const tz = row.timeZone || "America/Sao_Paulo";
      const local = DateTime.now().setZone(tz);
      if (!local.isValid) continue;

      const hm = parseHm(row.pluggyAutoBuscarTime);
      if (!hm) continue;
      if (local.hour !== hm.hour || local.minute !== hm.minute) continue;

      if (row.pluggyAutoBuscarLastRunAt) {
        const last = DateTime.fromJSDate(row.pluggyAutoBuscarLastRunAt).setZone(tz);
        if (last.isValid && last.hasSame(local, "day")) continue;
      }

      try {
        await runScheduledBuscarForUser(row.userId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[Pluggy/auto] Falha userId", row.userId, msg.slice(0, 200));
        await storage
          .updateUserSettings(row.userId, {
            pluggyAutoBuscarLastRunAt: new Date(),
            pluggyAutoBuscarLastSummary: `Erro: ${msg.slice(0, 200)}`,
          })
          .catch(() => undefined);
      }
    }
  } finally {
    tickRunning = false;
  }
}

/** Verifica a cada minuto se algum usuário deve rodar `/buscar` no horário configurado. */
export function startPluggyAutoBuscarScheduler(): void {
  if (isPluggyInMaintenance()) {
    console.log("[Pluggy/auto] Agendador não iniciado — Pluggy em manutenção.");
    return;
  }
  schedule.scheduleJob("* * * * *", () => {
    void tickPluggyAutoBuscar();
  });
  console.log("[Pluggy/auto] Agendador de busca diária iniciado (checagem a cada minuto).");
}
