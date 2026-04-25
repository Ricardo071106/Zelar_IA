import * as XLSX from 'xlsx';
import { normalizeAliasKey } from './normalizeGuestAlias';

export type SheetContactRow = { name?: string; email?: string; phone?: string };

const HEADER_SYNONYMS = {
  name: new Set(
    'nome name contato apelido participante aluno membro colaborador'.split(/\s+/).map((s) => normalizeAliasKey(s)),
  ),
  email: new Set('email e-mail e mail correio'.split(/\s+/).map((s) => normalizeAliasKey(s))),
  phone: new Set(
    'telefone fone phone celular whatsapp zap mobile numero número tel'.split(/\s+/).map((s) => normalizeAliasKey(s)),
  ),
} as const;

function rowStrings(row: unknown[]): string[] {
  return row.map((c) => (c == null ? '' : String(c).trim()));
}

function detectHeaderRow(matrix: string[][], maxScan: number): { rowIndex: number; nameI: number; emailI: number; phoneI: number } | null {
  for (let r = 0; r < Math.min(maxScan, matrix.length); r++) {
    const cells = rowStrings(matrix[r] as unknown[]);
    const norm = cells.map((c) => normalizeAliasKey(c));
    let nameI = -1;
    let emailI = -1;
    let phoneI = -1;
    for (let c = 0; c < norm.length; c++) {
      const key = norm[c] || '';
      for (const part of key.split(/\s+/)) {
        if (part && HEADER_SYNONYMS.name.has(part) && nameI < 0) nameI = c;
        if (part && HEADER_SYNONYMS.email.has(part) && emailI < 0) emailI = c;
        if (part && HEADER_SYNONYMS.phone.has(part) && phoneI < 0) phoneI = c;
      }
    }
    const ok =
      (nameI >= 0 && emailI >= 0) ||
      (nameI >= 0 && phoneI >= 0) ||
      (emailI >= 0 && phoneI >= 0) ||
      [nameI >= 0, emailI >= 0, phoneI >= 0].filter(Boolean).length >= 2;
    if (ok) {
      return { rowIndex: r, nameI, emailI, phoneI };
    }
  }
  if (matrix.length) {
    return { rowIndex: 0, nameI: 0, emailI: 1, phoneI: 2 };
  }
  return null;
}

/**
 * Lê a primeira aba de um .xlsx / .xls / .csv e identifica colunas de nome, e-mail e telefone
 * a partir do cabeçalho (ou heurística: coluna A = nome, B = email, C = fone).
 */
export function parseContactsFromSpreadsheetBuffer(buf: Buffer): { rows: SheetContactRow[]; sourceRowCount: number } {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const name0 = wb.SheetNames[0];
  if (!name0) return { rows: [], sourceRowCount: 0 };
  const sheet = wb.Sheets[name0];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false }) as unknown[][];
  if (!matrix.length) return { rows: [], sourceRowCount: 0 };
  const strMatrix = matrix.map((row) => (Array.isArray(row) ? rowStrings(row) : []));
  const head = detectHeaderRow(strMatrix, 15);
  if (!head) return { rows: [], sourceRowCount: 0 };
  const { rowIndex, nameI, emailI, phoneI } = head;
  const dataRows = strMatrix.slice(rowIndex + 1);
  const out: SheetContactRow[] = [];
  for (const r of dataRows) {
    const n = (nameI >= 0 ? r[nameI] : '')?.trim() || undefined;
    const e = (emailI >= 0 ? r[emailI] : '')?.trim() || undefined;
    const p = (phoneI >= 0 ? r[phoneI] : '')?.trim() || undefined;
    if (!e && !p) continue;
    if (!n && !e && !p) continue;
    out.push({ name: n, email: e, phone: p });
  }
  return { rows: out, sourceRowCount: dataRows.length };
}
