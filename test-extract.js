// Teste direto da função extractEventTitle e parseUserDateTime
import { extractEventTitle, parseUserDateTime } from './server/telegram/utils/parseDate.js';

const exemplos = [
  'jantar com o Gabriel amanhã',
  'almoço com Maria amanhã',
  'reunião com João amanhã às 15h',
  'consulta médica amanhã',
  'jantar amanhã',
  'lembre de pagar amanhã',
  'reunião com equipe sexta-feira',
  'almoço com equipe sexta 12h',
  'marque entrega da semana sexta às 15',
  'call de projeto quinta às 15h',
  'marque um almoço com a ordem daqui dois sábados às 13',
];

exemplos.forEach((exemplo) => {
  const resultado = extractEventTitle(exemplo);
  const data = parseUserDateTime(exemplo, 'testuser');
  console.log(`Input: "${exemplo}" => Título extraído: "${resultado}"`);
  if (data) {
    console.log(`  Data interpretada: ${data.readable} (ISO: ${data.iso})`);
  } else {
    console.log('  Data interpretada: não reconhecida');
  }
}); 