import { parseUserDateTime, setUserTimezone } from './server/telegram/utils/parseDate';

/**
 * Teste da nova função de interpretação de datas com detecção de fuso horário
 */
async function testNewDateParser() {
  console.log('🧪 Testando nova função de interpretação de datas\n');

  const userId = 'test-user';
  
  // Teste 1: Usar fuso padrão (São Paulo)
  console.log('=== TESTE 1: Fuso padrão (São Paulo) ===');
  const exemplos1 = [
    'sexta às 19h',
    'sexta às 19',
    '19',
    '7 da noite',
    'hoje às 15h',
    'amanhã às 9'
  ];

  for (const exemplo of exemplos1) {
    console.log(`\n📝 Testando: "${exemplo}"`);
    const resultado = parseUserDateTime(exemplo, userId, 'pt-BR');
    
    if (resultado) {
      console.log(`✅ Sucesso!`);
      console.log(`📅 ISO: ${resultado.iso}`);
      console.log(`📋 Legível: ${resultado.readable}`);
    } else {
      console.log(`❌ Não interpretou`);
    }
  }

  // Teste 2: Configurar fuso diferente (Nova York)
  console.log('\n\n=== TESTE 2: Fuso de Nova York ===');
  setUserTimezone(userId, 'America/New_York');
  
  const exemplos2 = [
    'sexta às 19h',
    'hoje às 15h'
  ];

  for (const exemplo of exemplos2) {
    console.log(`\n📝 Testando: "${exemplo}" (Nova York)`);
    const resultado = parseUserDateTime(exemplo, userId);
    
    if (resultado) {
      console.log(`✅ Sucesso!`);
      console.log(`📅 ISO: ${resultado.iso}`);
      console.log(`📋 Legível: ${resultado.readable}`);
    } else {
      console.log(`❌ Não interpretou`);
    }
  }

  // Teste 3: Comparar com São Paulo
  console.log('\n\n=== TESTE 3: Comparação São Paulo vs Nova York ===');
  const usuarioSP = 'user-sp';
  const usuarioNY = 'user-ny';
  
  setUserTimezone(usuarioSP, 'America/Sao_Paulo');
  setUserTimezone(usuarioNY, 'America/New_York');
  
  const teste = 'sexta às 19h';
  
  console.log(`\n📝 Testando: "${teste}"`);
  
  const resultadoSP = parseUserDateTime(teste, usuarioSP);
  const resultadoNY = parseUserDateTime(teste, usuarioNY);
  
  if (resultadoSP && resultadoNY) {
    console.log(`\n🇧🇷 São Paulo:`);
    console.log(`   ISO: ${resultadoSP.iso}`);
    console.log(`   Legível: ${resultadoSP.readable}`);
    
    console.log(`\n🇺🇸 Nova York:`);
    console.log(`   ISO: ${resultadoNY.iso}`);
    console.log(`   Legível: ${resultadoNY.readable}`);
  }
}

// Executar teste
testNewDateParser();