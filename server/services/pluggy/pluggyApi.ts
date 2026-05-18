const BASE = (process.env.PLUGGY_API_BASE_URL || "https://api.pluggy.ai").replace(/\/+$/, "");

/** Cache só para fluxo CLIENT_ID + CLIENT_SECRET (chave da /auth expira ~2h). */
let cachedClientCredsKey: { key: string; until: number } | null = null;
let inflightAuth: Promise<string> | null = null;

export function pluggyCredentialsConfigured(): boolean {
  if (process.env.PLUGGY_API_KEY?.trim()) return true;
  if (process.env.PLUGGY_CLIENT_ID?.trim() && process.env.PLUGGY_CLIENT_SECRET?.trim()) return true;
  return false;
}

function cacheTtlMsForApiKey(apiKey: string): number {
  const parts = apiKey.split(".");
  if (parts.length !== 3) return 365 * 24 * 60 * 60 * 1000;
  try {
    let b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    b64 += pad;
    const json = Buffer.from(b64, "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp === "number") {
      const ms = payload.exp * 1000 - Date.now() - 120_000;
      return Math.max(60_000, Math.min(ms, 110 * 60 * 1000));
    }
  } catch {
    /* ignore */
  }
  return 110 * 60 * 1000;
}

async function fetchApiKeyFromClientCredentials(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID?.trim();
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET ou PLUGGY_API_KEY");
  }

  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Pluggy auth HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  let data: unknown;
  try {
    data = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error("Pluggy /auth: resposta não é JSON");
  }
  const apiKey =
    data && typeof data === "object" && typeof (data as { apiKey?: unknown }).apiKey === "string"
      ? (data as { apiKey: string }).apiKey.trim()
      : "";
  if (!apiKey) {
    throw new Error("Pluggy /auth sem apiKey no JSON");
  }

  const now = Date.now();
  cachedClientCredsKey = {
    key: apiKey,
    until: now + cacheTtlMsForApiKey(apiKey),
  };
  return apiKey;
}

async function resolvePluggyApiKey(): Promise<string> {
  const staticKey = process.env.PLUGGY_API_KEY?.trim();
  if (staticKey) return staticKey;

  const now = Date.now();
  if (cachedClientCredsKey && cachedClientCredsKey.until > now + 15_000) {
    return cachedClientCredsKey.key;
  }

  inflightAuth ??= fetchApiKeyFromClientCredentials().finally(() => {
    inflightAuth = null;
  });
  return inflightAuth;
}

export async function pluggyFetchJson(pathOrUrl: string, init?: RequestInit): Promise<unknown> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  const key = await resolvePluggyApiKey();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Pluggy HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export type ConnectTokenResponse = {
  accessToken?: string;
  connectToken?: string;
};

export async function createPluggyConnectToken(opts: {
  clientUserId: string;
  webhookUrl?: string;
  oauthRedirectUri?: string;
}): Promise<ConnectTokenResponse> {
  const webhookUrl = opts.webhookUrl?.trim() || process.env.PLUGGY_WEBHOOK_URL?.trim();
  const body: Record<string, unknown> = {
    options: {
      clientUserId: opts.clientUserId,
      ...(webhookUrl ? { webhookUrl } : {}),
      ...(opts.oauthRedirectUri ? { oauthRedirectUri: opts.oauthRedirectUri } : {}),
    },
  };
  const data = (await pluggyFetchJson("/connect_token", {
    method: "POST",
    body: JSON.stringify(body),
  })) as ConnectTokenResponse;
  return data ?? {};
}

export function extractConnectToken(res: ConnectTokenResponse): string | null {
  const t = res.connectToken || res.accessToken;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}
