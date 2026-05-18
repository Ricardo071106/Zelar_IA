/**
 * Extrai apenas texto útil para casar com o cadastro do aluno (LGPD: não persistimos o extrato completo).
 * Ordem: paymentData.payer.name → heurísticas em description/descriptionRaw (PIX/TED comuns no Brasil).
 */
export function extractPayerNameFromPluggyTransaction(tx: {
  paymentData?: { payer?: { name?: string }; reason?: string };
  description?: string | null;
  descriptionRaw?: string | null;
  merchant?: { name?: string } | null;
  counterparty?: { name?: string } | null;
}): string | null {
  const direct = tx.paymentData?.payer?.name?.trim();
  if (direct) return sanitizePersonLabel(direct);
  const counterparty = tx.counterparty?.name?.trim();
  if (counterparty) return sanitizePersonLabel(counterparty);
  const merchant = tx.merchant?.name?.trim();
  if (merchant) return sanitizePersonLabel(merchant);

  const reason =
    typeof tx.paymentData?.reason === "string" && tx.paymentData.reason.trim().length > 0
      ? tx.paymentData.reason.trim()
      : "";
  const blob = [tx.descriptionRaw, tx.description, reason]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join("\n");
  if (!blob.trim()) return null;

  const t = blob.replace(/\s+/g, " ").trim();

  const attempts: RegExp[] = [
    /recebido.{0,24}pix.{0,12}(?:de|d)\s+(.+?)(?=\s+[-–|]|\s+valor\b|\s+vlr\b|\s*\d{1,2}\/\d{1,2}|\s+R\$\s|\s*$)/i,
    /pix\s+(?:recebido\s+)?(?:de\s+)?[-–:\s]+(.+?)(?=\s+[-–|]|\s+valor\b|\s+vlr\b|\s*\d{1,2}\/\d{1,2}|\s+R\$\s|\s*$)/i,
    /pix\s+recebido\s+(.+?)(?=\s+[-–|]|\s+valor\b|\s+vlr\b|\s*\d{1,2}\/\d{1,2}|\s+R\$\s|\s*$)/i,
    /(?:de|por)\s+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]+){1,5})(?=\s+[-–|]|\s+valor\b|\s+vlr\b|\s+R\$\s|\s*$)/,
    /(?:transferencia|transferência)\s+(?:recebida\s+)?(?:de\s+)?(.+?)(?=\s+[-–|]|\s+valor\b|\s*$)/i,
    /(?:pagador|origem|remetente|nome)\s*[:]\s*(.+?)(?=\s+[-–|]|$)/i,
    /ted\s+(?:de\s+)?(.+?)(?=\s+[-–|]|$)/i,
    /doc\s+(?:de\s+)?(.+?)(?=\s+[-–|]|$)/i,
  ];

  for (const re of attempts) {
    const m = t.match(re);
    if (m?.[1]) {
      const s = sanitizePersonLabel(m[1]);
      if (s && s.length >= 3) return s;
    }
  }

  const capitalWords = t.match(/\b([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})\b/);
  if (capitalWords?.[1]) {
    const s = sanitizePersonLabel(capitalWords[1]);
    if (s && s.length >= 5) return s;
  }

  return null;
}

/**
 * Para débitos (PIX/TED enviados): tenta extrair o favorecido para casar com o cadastro do aluno.
 */
export function extractReceiverNameFromPluggyTransaction(tx: {
  paymentData?: { receiver?: { name?: string }; payer?: { name?: string } };
  description?: string | null;
  descriptionRaw?: string | null;
}): string | null {
  const direct = tx.paymentData?.receiver?.name?.trim();
  if (direct) return sanitizePersonLabel(direct);

  const blob = [tx.descriptionRaw, tx.description].filter((x): x is string => typeof x === "string" && x.trim().length > 0).join("\n");
  if (!blob.trim()) return null;

  const t = blob.replace(/\s+/g, " ").trim();

  const attempts: RegExp[] = [
    /pix\s+enviado\s+(?:para\s+)?[-–:\s]*(.+?)(?=\s+[-–|]|\s+valor\b|\s+vlr\b|\s*\d{1,2}\/\d{1,2}|\s+R\$\s|\s*$)/i,
    /(?:ted|doc)\s+(?:para\s+)?[-–:\s]*(.+?)(?=\s+[-–|]|\s+valor\b|\s*$)/i,
    /(?:destinatario|destinatário|favorecido|nome)\s*[:]\s*(.+?)(?=\s+[-–|]|$)/i,
  ];

  for (const re of attempts) {
    const m = t.match(re);
    if (m?.[1]) {
      const s = sanitizePersonLabel(m[1]);
      if (s && s.length >= 3) return s;
    }
  }

  return null;
}

function sanitizePersonLabel(raw: string): string | null {
  let s = raw
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, " ")
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, " ")
    .replace(/\*{3,}\d+/g, " ")
    .replace(/\b(?:PIX|RECEBIDO|RECEBIDA|TRANSFER[EÊ]NCIA|TRANSF|TED|DOC|PAGADOR|ORIGEM|REMETENTE|NOME)\b/gi, " ")
    .replace(/\b(?:LTDA|ME|EIRELI|S\/?A|S\.A\.)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^[-–:\s]+|[-–:\s]+$/g, "").trim();
  if (s.length < 2 || s.length > 120) return null;
  return s;
}
