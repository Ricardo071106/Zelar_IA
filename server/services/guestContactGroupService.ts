import { storage } from '../storage';
import { normalizeAliasKey } from '../utils/normalizeGuestAlias';

/**
 * Se a mensagem citar o nome do grupo (ex.: "adicione o grupo Vendas" — contém "grupo vendas"),
 * considera o grupo acionado. Grupos com nomes "prefixo" (Vendas / Vendas SP) são desaninhados.
 */
function groupNameMentionedInText(t: string, normalizedName: string): boolean {
  if (normalizedName.length < 2) return false;
  if (t.includes(`grupo ${normalizedName}`)) return true;
  if (t.includes(`o grupo ${normalizedName}`)) return true;
  return false;
}

function selectMatchingGroups(
  groups: { id: number; normalizedName: string }[],
  t: string,
): { id: number; normalizedName: string }[] {
  const candidates = groups.filter((g) => groupNameMentionedInText(t, g.normalizedName));
  if (!candidates.length) return [];
  return candidates.filter((g) => {
    return !candidates.some(
      (h) =>
        h.id !== g.id &&
        h.normalizedName.length > g.normalizedName.length &&
        h.normalizedName.startsWith(`${g.normalizedName} `) &&
        groupNameMentionedInText(t, h.normalizedName),
    );
  });
}

export async function resolveGuestEmailsAndPhonesFromGroups(
  ownerUserId: number,
  text: string,
): Promise<{ emails: string[]; phones: string[] }> {
  const t = normalizeAliasKey(text);
  if (t.length < 4) return { emails: [], phones: [] };

  const groupRows = await storage.listUserContactGroupsWithMembers(ownerUserId);
  if (!groupRows.length) return { emails: [], phones: [] };

  const meta = groupRows.map((g) => ({ id: g.id, normalizedName: g.normalizedName }));
  const matched = selectMatchingGroups(meta, t);
  if (!matched.length) return { emails: [], phones: [] };

  const contactIdSet = new Set<number>();
  for (const m of matched) {
    const row = groupRows.find((r) => r.id === m.id);
    if (row) for (const id of row.contactIds) contactIdSet.add(id);
  }

  const allContacts = await storage.listUserGuestContacts(ownerUserId);
  const byId = new Map(allContacts.map((c) => [c.id, c]));
  const emails: string[] = [];
  const phones: string[] = [];
  for (const id of Array.from(contactIdSet)) {
    const c = byId.get(id);
    if (!c) continue;
    const e = c.canonicalEmail?.trim();
    if (e) emails.push(e.toLowerCase());
    const p = c.guestPhoneE164?.replace(/\D/g, '') || '';
    if (p) phones.push(p);
  }
  return { emails: Array.from(new Set(emails)), phones: Array.from(new Set(phones)) };
}
