import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Tokens OAuth da conta Google usada em `system_calendar_integrations` (ex.: conta Zelar).
 */
export async function getGoogleIntegrationTokensByKey(
  integrationKey: string,
): Promise<{ tokens: unknown } | null> {
  const key = integrationKey?.trim();
  if (!key) return null;
  try {
    const integrationResult = await db.execute(sql`
      SELECT tokens, active
      FROM public.system_calendar_integrations
      WHERE integration_key = ${key}
        AND provider = 'google'
      LIMIT 1
    `);
    const row = (integrationResult as { rows?: { tokens?: unknown; active?: boolean }[] })?.rows?.[0];
    if (!row || row.active === false) return null;
    const rawTokens = row.tokens;
    const tokens = typeof rawTokens === "string" ? JSON.parse(rawTokens) : rawTokens;
    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) return null;
    return { tokens };
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") {
      console.warn("[system_calendar] Tabela public.system_calendar_integrations ausente.");
      return null;
    }
    throw e;
  }
}
