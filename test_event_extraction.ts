import { extractEventInfo } from './server/telegram/utils/parseDate';

// Função para testar a extração de eventos
function testEventExtraction() {
  const testCases = [
    "Marque um jantar amanhã às 19",
    "Agendar reunião com Pedro segunda às 15h",
    "Me lembre de pagar o aluguel",
    "Marque um almoço sexta às 14",
    "Marque um almoço sexta 14",
    "Consulta médica dia 20/12/2025 às 10h",
    "Aniversário da Maria hoje às 19:00",
    "Ligar para o cliente às 16h",
    "Estudar para prova amanhã de manhã",
    "Fazer exercícios às 7am",
    "Comprar presente para João",
    // Teste específico para verificar lógica de "amanhã" à noite
    "Reunião amanhã às 10h"
  ];

  console.log("🧪 TESTANDO EXTRAÇÃO DE EVENTOS\n");
  console.log("=" .repeat(50));

  testCases.forEach((phrase, index) => {
    console.log(`\n📝 Teste ${index + 1}: "${phrase}"`);
    console.log("-".repeat(30));
    
    const result = extractEventInfo(phrase, "test-user", "pt-BR");
    
    console.log(`Nome do evento: ${result.eventName}`);
    console.log(`Data e hora: ${result.dateTime}`);
  });
}

// Executar os testes
testEventExtraction(); 