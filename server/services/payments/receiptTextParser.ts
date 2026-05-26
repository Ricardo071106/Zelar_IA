import * as chrono from "chrono-node";
import { DateTime } from "luxon";
import { extractPixEndToEndId } from "./pixDedupeKey";

export type ParsedReceipt = {
  amountCents: number;
  txPostedAt: Date;
  payerName: string | null;
  endToEndId: string | null;
  rawText: string;
};

function parseBrlAmountCents(text: string): number | null {
  const patterns = [
    /R\$\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/gi,
    /R\$\s*([\d]+[,.][\d]{2})/gi,
    /(?:valor|total|quantia)[:\s]*R?\$?\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/gi,
    /([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\s*(?:reais|brl)?/gi,
  ];
  const amounts: number[] = [];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text)) !== null) {
      const raw = m[1].replace(/\./g, "").replace(",", ".");
      const v = Number.parseFloat(raw);
      if (Number.isFinite(v) && v > 0 && v < 1_000_000) {
        amounts.push(Math.round(v * 100));
      }
    }
  }
  if (!amounts.length) return null;
  return Math.max(...amounts);
}

function parsePayerName(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const labelRe =
    /^(?:de|pagador|origem|quem\s+enviou|nome\s+do\s+pagador|remetente)\s*[:\-]?\s*(.+)$/i;
  for (const line of lines) {
    const m = line.match(labelRe);
    if (m?.[1] && m[1].length >= 4 && m[1].length <= 120) {
      return m[1].replace(/\s+/g, " ").trim();
    }
  }
  const inline = text.match(
    /(?:pagador|de|origem|remetente)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{3,80})/i,
  );
  if (inline?.[1]) return inline[1].replace(/\s+/g, " ").trim();
  return null;
}

function parseReceiptDate(text: string, timeZone: string): Date {
  const pt = chrono.pt.parse(text, new Date(), { forwardDate: false });
  if (pt.length > 0 && pt[0].start) {
    const d = pt[0].start.date();
    if (!Number.isNaN(d.getTime())) return d;
  }
  const br = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})(?:\s+(\d{1,2})[:\h](\d{2}))?/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    let year = Number(br[3]);
    if (year < 100) year += 2000;
    const hour = br[4] ? Number(br[4]) : 12;
    const minute = br[5] ? Number(br[5]) : 0;
    const dt = DateTime.fromObject({ year, month, day, hour, minute }, { zone: timeZone });
    if (dt.isValid) return dt.toJSDate();
  }
  return new Date();
}

export function parseReceiptFromOcrText(text: string, timeZone = "America/Sao_Paulo"): ParsedReceipt | null {
  const rawText = text.replace(/\r/g, "\n").trim();
  if (rawText.length < 8) return null;

  const amountCents = parseBrlAmountCents(rawText);
  if (!amountCents || amountCents <= 0) return null;

  const upper = rawText.toUpperCase();
  if (/PIX\s+ENVIAD|TRANSFERENCIA\s+ENVIAD|VOCE\s+ENVIOU|PAGAMENTO\s+EFETUADO\s+PARA/i.test(upper)) {
    return null;
  }

  const txPostedAt = parseReceiptDate(rawText, timeZone);
  const payerName = parsePayerName(rawText);
  const endToEndId = extractPixEndToEndId(rawText);

  // Apenas PIX: exige E2E ou texto típico de PIX recebido.
  const looksPix =
    Boolean(endToEndId) ||
    /PIX\s+RECEBID|RECEBIDO.{0,32}PIX|CREDITO\s+DE\s+PIX|CR[EÉ]DITO\s+PIX/i.test(upper);
  if (!looksPix) return null;

  return {
    amountCents,
    txPostedAt,
    payerName,
    endToEndId,
    rawText,
  };
}
