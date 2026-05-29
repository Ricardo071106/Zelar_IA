import type { UserGuestContactRow } from "../../storage";
import { normalizeAliasKey } from "../../utils/normalizeGuestAlias";

export function nameMatchesOwnerKeys(name: string, ownerKeys: string[]): boolean {
  const key = normalizeAliasKey(name);
  if (!key || key.length < 2) return false;
  for (const ok of ownerKeys) {
    if (!ok) continue;
    if (key === ok) return true;
    if (key.length >= 5 && ok.length >= 5 && (key.includes(ok) || ok.includes(key))) return true;
    const tokK = key.split(/\s+/).filter((t) => t.length >= 3);
    const tokO = ok.split(/\s+/).filter((t) => t.length >= 3);
    if (tokK.length >= 2 && tokO.length >= 2 && tokK.every((t) => ok.includes(t))) return true;
    if (tokO.length >= 2 && tokK.length >= 2 && tokO.every((t) => key.includes(t))) return true;
  }
  return false;
}

export function contactMatchesOwnerKeys(row: UserGuestContactRow, ownerKeys: string[]): boolean {
  if (!ownerKeys.length) return false;
  for (const alias of row.aliasNames ?? []) {
    if (nameMatchesOwnerKeys(alias, ownerKeys)) return true;
  }
  return false;
}

export function rejectOwnerContact(
  contact: UserGuestContactRow | null,
  ownerKeys: string[],
  neverMatchAccountOwner: boolean,
): UserGuestContactRow | null {
  if (!contact || !neverMatchAccountOwner) return contact;
  if (contactMatchesOwnerKeys(contact, ownerKeys)) return null;
  return contact;
}
