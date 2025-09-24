function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractEventTitle(text) {
  const textLower = text.toLowerCase();

  let cleanTitle = text;

  const limparTitulo = (texto) =>
    texto
      .replace(/\b(marque|agende|coloque|anote|lembre|crie|faça|criar|fazer)\b/gi, '')
      .replace(/\b(me\s+lembre\s+de|lembre\s+me\s+de|me\s+lembrar\s+de)\b/gi, '')
      .replace(/\b(às|as)\s+\d{1,2}(:\d{2})?\s?(h|horas?|pm|am)?\b/gi, '')
      .replace(/\b(amanhã|amanha|hoje|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
      .replace(/\b(da\s+manhã|da\s+tarde|da\s+noite|de\s+manhã|de\s+tarde|de\s+noite)\b/gi, '')
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  cleanTitle = limparTitulo(cleanTitle);

  const temporalPatterns = [
    /\b(próxima|proxima|que\s+vem)\b/gi,
    /\b(depois|antes|agora|já|ainda)\b/gi
  ];

  for (const pattern of temporalPatterns) {
    cleanTitle = cleanTitle.replace(pattern, ' ');
  }

  cleanTitle = cleanTitle
    .replace(/\s+/g, ' ')
    .replace(/^\s*(o|a|os|as|um|uma|no|na|em|de|da|do|às|as|para|pra)\s+/i, '')
    .replace(/\s+(no|na|em|de|da|do|às|as|para|pra)\s*$/i, '')
    .replace(/^\s*(e|com|sem|por)\s+/i, '')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

  if (cleanTitle.length > 2) {
    return capitalizeFirst(cleanTitle);
  }

  const specificPatterns = [
    { regex: /reunião\s+com\s+([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match) => `Reunião com ${match}` },
    { regex: /consulta\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match) => `Consulta Dr. ${match}` },
    { regex: /dentista\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match) => `Dentista Dr. ${match}` },
    { regex: /médico\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match) => `Médico Dr. ${match}` },
    { regex: /aniversário\s+(?:do\s+|da\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match) => `Aniversário ${match}` },
    { regex: /festa\s+(?:do\s+|da\s+|de\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match) => `Festa ${match}` }
  ];

  for (const pattern of specificPatterns) {
    const match = textLower.match(pattern.regex);
    if (match && match[1]) {
      const result = pattern.format(match[1].trim());
      return capitalizeFirst(result);
    }
  }

  const actionVerbs = [
    /(?:me\s+)?lembre?\s+de\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /(?:vou\s+|ir\s+)?fazer\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /agende?\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /marque?\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /criar?\s+(?:um\s+|uma\s+)?(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i
  ];

  for (const verb of actionVerbs) {
    const match = text.match(verb);
    if (match && match[1]) {
      let extracted = match[1].trim();
      extracted = extracted.replace(/^(um|uma|o|a|os|as)\s+/i, '');
      return capitalizeFirst(extracted);
    }
  }

  const directKeywords = [
    'jantar', 'almoço', 'almoco', 'academia', 'trabalho', 'escola', 'aula',
    'compromisso', 'consulta', 'exame', 'reunião', 'reuniao', 'compras'
  ];

  for (const keyword of directKeywords) {
    if (textLower.includes(keyword)) {
      return capitalizeFirst(keyword);
    }
  }

  let cleaned = text
    .replace(/^(me\s+lembre\s+de\s+|agende\s+|marque\s+|criar?\s+|vou\s+|ir\s+)/i, '')
    .replace(/^(um|uma|o|a|os|as)\s+/i, '')
    .replace(/\b(amanhã|amanha|hoje|ontem)\b/gi, '')
    .replace(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
    .replace(/\b(próxima|proxima|que vem|na|no)\b/gi, '')
    .replace(/\bàs?\s+\d{1,2}(:\d{2})?h?\b/gi, '')
    .replace(/\b\d{1,2}(am|pm)\b/gi, '')
    .replace(/\b(da manhã|da manha|da tarde|da noite)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return capitalizeFirst(cleaned) || 'Evento';
}
export { extractEventTitle, capitalizeFirst };
export default extractEventTitle;
