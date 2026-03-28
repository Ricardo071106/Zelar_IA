const PHONE_LIST_TRIGGER =
  /(?:mande\s+)?(?:para|pra)\s+([^.!?\n@]{4,180})/gi;
const PHONE_LIST_TRIGGER2 =
  /(?:envie|enviar|convidar|chamar|passar|manda|digite\s+o\s+n[uú]mero)\s+(?:para|pra)\s+([^.!?\n@]{4,180})/gi;

const SPLIT_TOKENS = /\s*,\s*|\s+v[ií]rgula\s+|\s+e\s+(?=[\d\w])/i;

function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const WORD_TO_DIGITS: Record<string, string> = (() => {
  const m: Record<string, string> = {
    zero: '0',
    um: '1',
    uma: '1',
    dois: '2',
    duas: '2',
    tres: '3',
    quatro: '4',
    cinco: '5',
    seis: '6',
    meia: '6',
    sete: '7',
    oito: '8',
    nove: '9',
    dez: '10',
    onze: '11',
    doze: '12',
    treze: '13',
    quatorze: '14',
    catorze: '14',
    quinze: '15',
    dezesseis: '16',
    dezessete: '17',
    dezoito: '18',
    dezenove: '19',
    vinte: '20',
  };
  return m;
})();

function tokenToDigits(token: string): string | null {
  const t = token.trim();
  if (!t) return '';
  if (/^\d+$/.test(t)) return t;
  const key = stripAccents(t).replace(/[^a-z]/g, '');
  if (!key) return null;
  if (WORD_TO_DIGITS[key] !== undefined) return WORD_TO_DIGITS[key];
  return null;
}

function parseSpokenListSegment(segment: string): string {
  const parts = segment.split(SPLIT_TOKENS).map((p) => p.trim()).filter(Boolean);
  let out = '';
  for (const part of parts) {
    const words = part.split(/\s+/);
    let chunk = '';
    for (const w of words) {
      if (/^\d+$/.test(w)) {
        chunk += w;
        continue;
      }
      const conv = tokenToDigits(w);
      if (conv !== null) chunk += conv;
    }
    out += chunk;
  }
  return out.replace(/\D/g, '');
}

export function normalizeBrazilianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = normalized.replace(/^0+/, '');
  }

  if (normalized.length === 11 && /^[1-9]{2}9\d{8}$/.test(normalized)) {
    return `55${normalized}`;
  }

  if (normalized.length === 13 && /^55[1-9]{2}9\d{8}$/.test(normalized)) {
    return normalized;
  }

  if (normalized.length === 10 && /^[1-9]{2}\d{8}$/.test(normalized)) {
    return `55${normalized.slice(0, 2)}9${normalized.slice(2)}`;
  }

  if (normalized.length === 12 && /^55[1-9]{2}\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}9${normalized.slice(4)}`;
  }

  return null;
}

function splitDigitStreamIntoPhones(flatDigits: string): string[] {
  const d = flatDigits.replace(/\D/g, '');
  const out: string[] = [];
  let i = 0;
  while (i < d.length) {
    let consumed = false;
    if (d.length - i >= 13 && d.slice(i, i + 2) === '55') {
      const chunk = d.slice(i, i + 13);
      const n = normalizeBrazilianPhone(chunk);
      if (n) {
        out.push(n);
        i += 13;
        consumed = true;
      }
    }
    if (!consumed && d.length - i >= 11) {
      const chunk = d.slice(i, i + 11);
      if (/^[1-9]{2}9\d{8}$/.test(chunk)) {
        out.push(`55${chunk}`);
        i += 11;
        consumed = true;
      }
    }
    if (!consumed && d.length - i >= 10) {
      const chunk = d.slice(i, i + 10);
      const n = normalizeBrazilianPhone(chunk);
      if (n) {
        out.push(n);
        i += 10;
        consumed = true;
      }
    }
    if (!consumed) i += 1;
  }
  return [...new Set(out)];
}

function extractPhonesFromTriggeredLists(text: string): string[] {
  const found = new Set<string>();
  const t = text;
  const run = (re: RegExp) => {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(t)) !== null) {
      const segment = m[1] || '';
      const digits = parseSpokenListSegment(segment);
      if (digits.length >= 10) {
        for (const p of splitDigitStreamIntoPhones(digits)) {
          found.add(p);
        }
      }
    }
  };
  run(PHONE_LIST_TRIGGER);
  run(PHONE_LIST_TRIGGER2);
  return [...found];
}

function extractPhonesFromRegex(text: string): string[] {
  const phoneCandidates = text.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4})[-\s]?\d{4}/g) || [];
  const normalized = phoneCandidates
    .map((candidate) => normalizeBrazilianPhone(candidate))
    .filter((phone): phone is string => !!phone);
  return [...new Set(normalized)];
}

export function extractPhonesFromWrittenAndSpoken(text: string): string[] {
  const a = extractPhonesFromRegex(text);
  const b = extractPhonesFromTriggeredLists(text);
  return [...new Set([...a, ...b])];
}
