import { stripEmails } from './attendeeExtractor.js';

function removeInviteInstructions(text) {
  if (!text) return '';
  return text
    .replace(/(?:,?\s*)?(?:e\s+)?(?:manda|mande|mandar|mandei|envia|envie|enviar|enviei|adiciona|adicionar|adiciona?e?|coloca|colocar|inclui|incluir)\s+(?:pra|para|pro|a|o|os|as)\b.*$/gi, '')
    .trim();
}

function removeTemporalExpressions(text) {
  if (!text) return '';
  return text
    .replace(/\b(hoje|amanhã|amanha|agora|depois|ontem|já|ja|ainda)\b/gi, '')
    .replace(/\b(próxima|proxima|passada|seguinte)\b/gi, '')
    .replace(/\bque\s+vem\b/gi, '')
    .replace(/\b(dia)\s+\d{1,2}\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '')
    .replace(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?\b/gi, '')
    .replace(/\b(?:às|ás|as|a)\s*\d{1,2}(?::\d{2})?\s*(?:h|horas?|pm|am)?\b/gi, '')
    .replace(/\b(?:da|de|do|pela|pelos|pelas|ao|aos)\s+(manhã|manha|tarde|noite)\b/gi, '')
    .replace(/\b(?:pela|na|no|em)\s+(manhã|manha|tarde|noite)\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*$/g, '')
    .replace(/\s+e\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractEventTitle(text) {
  let sanitizedText = stripEmails(text);
  sanitizedText = removeInviteInstructions(sanitizedText);
  const textLower = sanitizedText.toLowerCase();

  let cleanTitle = sanitizedText;

  const limparTitulo = (texto) =>
    removeInviteInstructions(texto)
      .replace(/\b(marque|agende|coloque|anote|lembre|crie|faça|criar|fazer)\b/gi, '')
      .replace(/\b(me\s+lembre\s+de|lembre\s+me\s+de|me\s+lembrar\s+de)\b/gi, '')
      .replace(/\b(às|as)\s+\d{1,2}(:\d{2})?\s?(h|horas?|pm|am)?\b/gi, '')
      .replace(/\b(amanhã|amanha|hoje|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
      .replace(/\b(da\s+manhã|da\s+tarde|da\s+noite|de\s+manhã|de\s+tarde|de\s+noite)\b/gi, '')
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '')
      .replace(/(?:,?\s*)?(?:e\s+)?(?:manda|envia|enviar|mandar|adiciona|adicionar|coloca|colocar|inclui|incluir)\s+(?:pra|para|pro|a|o|os|as)\b.*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  cleanTitle = limparTitulo(cleanTitle);
  cleanTitle = removeTemporalExpressions(cleanTitle);

  const temporalPatterns = [
    /\b(próxima|proxima|que\s+vem)\b/gi,
    /\b(depois|antes|agora|já|ja|ainda)\b/gi
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
      const result = pattern.format(removeInviteInstructions(match[1].trim()));
      const cleanedResult = removeTemporalExpressions(result);
      return capitalizeFirst(cleanedResult);
    }
  }

  const actionVerbs = [
    /(?:me\s+)?lembre?\s+de\s+(.+?)(?:\s+(?:hoje|amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|às|as|na|no)|\s*$)/i,
    /(?:vou\s+|ir\s+)?fazer\s+(.+?)(?:\s+(?:hoje|amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|às|as|na|no)|\s*$)/i,
    /agende?\s+(.+?)(?:\s+(?:hoje|amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|às|as|na|no)|\s*$)/i,
    /marque?\s+(.+?)(?:\s+(?:hoje|amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|às|as|na|no)|\s*$)/i,
    /criar?\s+(?:um\s+|uma\s+)?(.+?)(?:\s+(?:hoje|amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|às|as|na|no)|\s*$)/i
  ];

  for (const verb of actionVerbs) {
    const match = sanitizedText.match(verb);
    if (match && match[1]) {
      let extracted = removeInviteInstructions(match[1])
        .trim();
      extracted = removeTemporalExpressions(extracted);
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
      const keywordMatch = sanitizedText.match(new RegExp(`${keyword}\\s+com\\s+([^,]+)`, 'i'));
      if (keywordMatch && keywordMatch[1]) {
        const participant = removeInviteInstructions(removeTemporalExpressions(keywordMatch[1].trim()));
        if (participant) {
          return capitalizeFirst(`${keyword} com ${participant}`);
        }
      }
      return capitalizeFirst(keyword);
    }
  }

  let cleaned = stripEmails(text)
    .replace(/^(me\s+lembre\s+de\s+|agende\s+|marque\s+|criar?\s+|vou\s+|ir\s+)/i, '')
    .replace(/^(um|uma|o|a|os|as)\s+/i, '')
    .replace(/\b(amanhã|amanha|hoje|ontem)\b/gi, '')
    .replace(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
    .replace(/\b(próxima|proxima|que vem|na|no)\b/gi, '')
    .replace(/\bàs?\s+\d{1,2}(:\d{2})?h?\b/gi, '')
    .replace(/\b\d{1,2}(am|pm)\b/gi, '')
    .replace(/\b(da manhã|da manha|da tarde|da noite)\b/gi, '')
    .replace(/(?:,?\s*)?(?:e\s+)?(?:manda|envia|enviar|mandar|adiciona|adicionar|coloca|colocar|inclui|incluir)\s+(?:pra|para|pro|a|o|os|as)\b.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  cleaned = removeInviteInstructions(cleaned);
  cleaned = removeTemporalExpressions(cleaned);

  return capitalizeFirst(cleaned) || 'Evento';
}
export { extractEventTitle, capitalizeFirst };
export default extractEventTitle;
