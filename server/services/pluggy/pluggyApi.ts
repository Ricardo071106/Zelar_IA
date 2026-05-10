const BASE = (process.env.PLUGGY_API_BASE_URL || "https://api.pluggy.ai").replace(/\/+$/, "");

function apiKey(): string {
  const k = process.env.PLUGGY_API_KEY?.trim();
  if (!k) throw new Error("PLUGGY_API_KEY ausente");
  return k;
}

export async function pluggyFetchJson(pathOrUrl: string, init?: RequestInit): Promise<unknown> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey(),
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
