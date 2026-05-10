import * as XLSX from "xlsx";
import { normalizeAliasKey } from "./normalizeGuestAlias";

export type SheetContactRow = {
  name?: string;
  email?: string;
  phone?: string;
  /** Linha aproximada na planilha (1-based), útil para mensagens de erro */
  sourceLine?: number;
};

const HEADER_SYNONYMS = {
  name: new Set(
    "nome name nom completo nome completo full name contato apelido participante aluno membro colaborador cliente estudante paciente responsavel responsável titular"
      .split(/\s+/)
      .map((s) => normalizeAliasKey(s)),
  ),
  email: new Set(
    "email e-mail e mail correio endereco eletronico endereço eletronico eletrônico".split(/\s+/).map((s) => normalizeAliasKey(s)),
  ),
  phone: new Set(
    "telefone fone phone celular whatsapp zap mobile numero número num tel contact".split(/\s+/).map((s) => normalizeAliasKey(s)),
  ),
} as const;

function cellToString(c: unknown): string {
  if (c == null || c === "") return "";
  if (c instanceof Date) {
    try {
      return c.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return String(c).trim();
    }
  }
  if (typeof c === "number") {
    return String(c);
  }
  return String(c).trim();
}

function rowStrings(row: unknown[]): string[] {
  return row.map((c) => cellToString(c));
}

/** Cabeçalho típico: poucos caracteres ou palavras-chave, sem e-mail na linha inteira */
function looksLikeHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  if (joined.includes("@")) return false;
  const nonEmpty = cells.filter((x) => x.trim().length > 0);
  if (nonEmpty.length === 0) return false;
  const allShort = nonEmpty.every((x) => x.length <= 48);
  const headerHints = /\b(nome|name|email|e-mail|mail|telefone|fone|phone|celular|whatsapp|numero|número|contato)\b/i.test(
    joined,
  );
  return allShort && (headerHints || nonEmpty.every((x) => x.split(/\s+/).length <= 4));
}

function columnSynonymScore(normCell: string, kind: "name" | "email" | "phone"): number {
  const syn = HEADER_SYNONYMS[kind];
  let score = 0;
  const parts = normCell.split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (part && syn.has(part)) score += 2;
  }
  if (normCell.length >= 4) {
    for (const token of syn) {
      if (token.length >= 4 && normCell.includes(token)) score += 1;
    }
  }
  return score;
}

function detectHeaderRow(
  matrix: string[][],
  maxScan: number,
): { rowIndex: number; nameI: number; emailI: number; phoneI: number } | null {
  for (let r = 0; r < Math.min(maxScan, matrix.length); r++) {
    const cells = matrix[r] || [];
    let bestName = -1,
      bestEmail = -1,
      bestPhone = -1;
    let scoreName = 0,
      scoreEmail = 0,
      scorePhone = 0;

    for (let c = 0; c < cells.length; c++) {
      const norm = normalizeAliasKey(cells[c] || "");
      const sn = columnSynonymScore(norm, "name");
      const se = columnSynonymScore(norm, "email");
      const sp = columnSynonymScore(norm, "phone");
      if (sn > scoreName) {
        scoreName = sn;
        bestName = c;
      }
      if (se > scoreEmail) {
        scoreEmail = se;
        bestEmail = c;
      }
      if (sp > scorePhone) {
        scorePhone = sp;
        bestPhone = c;
      }
    }

    const nameI = scoreName > 0 ? bestName : -1;
    const emailI = scoreEmail > 0 ? bestEmail : -1;
    const phoneI = scorePhone > 0 ? bestPhone : -1;

    const ok =
      (nameI >= 0 && emailI >= 0) ||
      (nameI >= 0 && phoneI >= 0) ||
      (emailI >= 0 && phoneI >= 0) ||
      [nameI >= 0, emailI >= 0, phoneI >= 0].filter(Boolean).length >= 2;

    if (ok) {
      return { rowIndex: r, nameI, emailI, phoneI };
    }
  }

  if (matrix.length >= 1 && matrix[0].length >= 3) {
    return { rowIndex: 0, nameI: 0, emailI: 1, phoneI: 2 };
  }
  if (matrix.length >= 1 && matrix[0].length === 2) {
    return { rowIndex: 0, nameI: 0, emailI: 1, phoneI: -1 };
  }
  return null;
}

const EMAIL_CELL = /\S+@\S+\.\S+/;

function looksLikePhoneCell(s: string): boolean {
  const d = s.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13;
}

/**
 * Quando não há cabeçalho reconhecível: infere colunas pela forma dos dados (e-mail, telefone BR, texto de nome).
 */
function inferColumnsFromContent(strMatrix: string[][]): { dataStart: number; nameI: number; emailI: number; phoneI: number } | null {
  if (!strMatrix.length) return null;
  let start = 0;
  if (strMatrix.length > 1 && looksLikeHeaderRow(strMatrix[0])) {
    start = 1;
  }

  const sample = strMatrix.slice(start, Math.min(strMatrix.length, start + 60));
  const maxCols = Math.max(0, ...sample.map((r) => r.length));

  if (maxCols < 2) return null;

  let bestEmail = -1,
    bestEmailScore = -1;
  let bestPhone = -1,
    bestPhoneScore = -1;

  for (let c = 0; c < maxCols; c++) {
    let es = 0,
      ps = 0;
    for (const row of sample) {
      const cell = (row[c] || "").trim();
      if (!cell) continue;
      if (EMAIL_CELL.test(cell)) es++;
      if (looksLikePhoneCell(cell)) ps++;
    }
    if (es > bestEmailScore) {
      bestEmailScore = es;
      bestEmail = c;
    }
    if (ps > bestPhoneScore) {
      bestPhoneScore = ps;
      bestPhone = c;
    }
  }

  if (bestEmailScore < 1 && bestPhoneScore < 1) return null;

  let bestName = -1,
    bestNameScore = -1;
  for (let c = 0; c < maxCols; c++) {
    if (c === bestEmail || c === bestPhone) continue;
    let wordSum = 0,
      n = 0;
    for (const row of sample) {
      const cell = (row[c] || "").trim();
      if (!cell || EMAIL_CELL.test(cell) || looksLikePhoneCell(cell)) continue;
      wordSum += cell.split(/\s+/).filter(Boolean).length;
      n++;
    }
    const avg = n ? wordSum / n : 0;
    if (avg >= bestNameScore) {
      bestNameScore = avg;
      bestName = c;
    }
  }

  if (bestName < 0) return null;

  return {
    dataStart: start,
    nameI: bestName,
    emailI: bestEmail,
    phoneI: bestPhone,
  };
}

/**
 * Lê a primeira aba de um .xlsx / .xls / .csv.
 * Usa só colunas de nome, e-mail e telefone; demais colunas são ignoradas.
 */
export function parseContactsFromSpreadsheetBuffer(buf: Buffer): {
  rows: SheetContactRow[];
  sourceRowCount: number;
  headerRowIndex: number | null;
  usedHeuristic: boolean;
} {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true, raw: false });
  const name0 = wb.SheetNames[0];
  if (!name0) return { rows: [], sourceRowCount: 0, headerRowIndex: null, usedHeuristic: false };

  const sheet = wb.Sheets[name0];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }) as unknown[][];
  if (!matrix.length) return { rows: [], sourceRowCount: 0, headerRowIndex: null, usedHeuristic: false };

  const strMatrix = matrix.map((row) => (Array.isArray(row) ? rowStrings(row) : []));

  let head = detectHeaderRow(strMatrix, 25);
  let usedHeuristic = false;
  let dataRows: string[][] = [];
  let headerRowIndex: number | null = null;
  let excelBaseLine = 1;

  if (head) {
    headerRowIndex = head.rowIndex;
    excelBaseLine = head.rowIndex + 2;
    dataRows = strMatrix.slice(head.rowIndex + 1);
    const { rowIndex, nameI, emailI, phoneI } = head;
    const preview = dataRows.slice(0, 5);
    const hasData = preview.some((r) => {
      const e = emailI >= 0 ? r[emailI] : "";
      const p = phoneI >= 0 ? r[phoneI] : "";
      return EMAIL_CELL.test(e || "") || looksLikePhoneCell(p || "");
    });
    if (!hasData && dataRows.length > 0) {
      head = null;
    }
  }

  if (!head) {
    const inferred = inferColumnsFromContent(strMatrix);
    if (!inferred) return { rows: [], sourceRowCount: 0, headerRowIndex: null, usedHeuristic: false };
    usedHeuristic = true;
    headerRowIndex = inferred.dataStart > 0 ? inferred.dataStart - 1 : null;
    excelBaseLine = inferred.dataStart + 1;
    const { dataStart, nameI, emailI, phoneI } = inferred;
    dataRows = strMatrix.slice(dataStart);
    head = { rowIndex: dataStart - 1, nameI, emailI, phoneI };
  }

  const { nameI, emailI, phoneI } = head!;
  const out: SheetContactRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const n = (nameI >= 0 ? r[nameI] : "")?.trim() || undefined;
    const e = (emailI >= 0 ? r[emailI] : "")?.trim() || undefined;
    const p = (phoneI >= 0 ? r[phoneI] : "")?.trim() || undefined;
    if (!n && !e && !p) continue;
    out.push({ name: n, email: e, phone: p, sourceLine: excelBaseLine + i });
  }

  return {
    rows: out,
    sourceRowCount: dataRows.length,
    headerRowIndex,
    usedHeuristic,
  };
}
