import { parseUserDateTime, setUserTimezone } from './server/telegram/utils/parseDate';

/**
 * Teste específico para verificar correção de "da noite"
 */
async function testChronoFix() {
  console.log('🧪 Testando correção "da noite" com chrono-node\n');

  const userId = 'test-user';
  
  // Teste casos problemáticos
  const casos = [
    'sexta às sete da noite',      // Deve ser 19h, não 7h
    'quinta às oito da noite',     // Deve ser 20h, não 8h
    'hoje às nove da noite',       // Deve ser 21h, não 9h
    'sexta às 19h',                // Deve continuar 19h
    'sexta às 7pm',                // Deve ser 19h
    'amanhã às dez da manhã'       // Deve ser 10h (sem mudança)
  ];

  for (const caso of casos) {
    console.log(`\n📝 Testando: "${caso}"`);
    
    const resultado = parseUserDateTime(caso, userId, 'pt-BR');
    
    if (resultado) {
      console.log(`✅ Interpretado:`);
      console.log(`   📅 ISO: ${resultado.iso}`);
      console.log(`   📋 Legível: ${resultado.readable}`);
      
      // Extrair hora do ISO para verificar
      const hora = new Date(resultado.iso).getHours();
      console.log(`   🕐 Hora extraída: ${hora}h`);
    } else {
      console.log(`❌ Não conseguiu interpretar`);
    }
  }

  // Teste com fuso diferente
  console.log('\n\n=== Teste com fuso de Nova York ===');
  setUserTimezone(userId, 'America/New_York');
  
  const teste = 'sexta às sete da noite';
  console.log(`\n📝 Testando: "${teste}" (Nova York)`);
  
  const resultado = parseUserDateTime(teste, userId);
  if (resultado) {
    console.log(`✅ NY: ${resultado.readable}`);
    console.log(`📅 ISO: ${resultado.iso}`);
  }
}

testChronoFix();