import { parseBrazilianDateTime, formatBrazilianDateTime } from './server/utils/dateParser';

/**
 * Script de teste para a função de interpretação de datas
 */
async function testDateParser() {
  console.log('🧪 Testando interpretação de datas em português\n');

  const exemplos = [
    'amanhã às 9',
    'quarta às sete da noite',
    'sexta que vem às 19h',
    'segunda-feira às 14:30',
    'hoje às 18h',
    'próxima terça às 10 da manhã',
    'sábado às 15h30',
    'domingo que vem às 8 da manhã',
    'quinta às 21h',
    'amanhã de tarde às 16h'
  ];

  for (const exemplo of exemplos) {
    console.log(`\n📝 Testando: "${exemplo}"`);
    
    const resultado = parseBrazilianDateTime(exemplo);
    
    if (resultado) {
      console.log(`✅ Sucesso!`);
      console.log(`📅 ISO: ${resultado.iso}`);
      console.log(`📋 Legível: ${resultado.readable}`);
    } else {
      console.log(`❌ Não foi possível interpretar`);
    }
    
    console.log('-'.repeat(50));
  }
}

// Executar teste
testDateParser();