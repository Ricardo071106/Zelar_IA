/**
 * Script simples para processar datas em mensagens em português
 * 
 * Use: node simple_date_processor.ts "Agendar reunião com João na próxima sexta às 10h"
 */

function processDate(text: string) {
  const today = new Date();
  let resultDate = new Date();
  
  // Converter para minúsculas para facilitar as comparações
  const textoLower = text.toLowerCase();
  
  // Próximos dias da semana
  if (textoLower.includes("próxima segunda") || textoLower.includes("proxima segunda")) {
    // Encontra a próxima segunda-feira
    resultDate.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7));
    console.log("Encontrei próxima segunda-feira");
  } else if (textoLower.includes("próxima terça") || textoLower.includes("proxima terca")) {
    // Encontra a próxima terça-feira
    resultDate.setDate(today.getDate() + ((2 + 7 - today.getDay()) % 7));
    console.log("Encontrei próxima terça-feira");
  } else if (textoLower.includes("próxima quarta") || textoLower.includes("proxima quarta")) {
    // Encontra a próxima quarta-feira
    resultDate.setDate(today.getDate() + ((3 + 7 - today.getDay()) % 7));
    console.log("Encontrei próxima quarta-feira");
  } else if (textoLower.includes("próxima quinta") || textoLower.includes("proxima quinta")) {
    // Encontra a próxima quinta-feira
    resultDate.setDate(today.getDate() + ((4 + 7 - today.getDay()) % 7));
    console.log("Encontrei próxima quinta-feira");
  } else if (textoLower.includes("próxima sexta") || textoLower.includes("proxima sexta")) {
    // Encontra a próxima sexta-feira
    resultDate.setDate(today.getDate() + ((5 + 7 - today.getDay()) % 7));
    console.log("Encontrei próxima sexta-feira");
  } else if (textoLower.includes("próximo sábado") || textoLower.includes("proximo sabado")) {
    // Encontra o próximo sábado
    resultDate.setDate(today.getDate() + ((6 + 7 - today.getDay()) % 7));
    console.log("Encontrei próximo sábado");
  } else if (textoLower.includes("próximo domingo") || textoLower.includes("proximo domingo")) {
    // Encontra o próximo domingo
    resultDate.setDate(today.getDate() + ((0 + 7 - today.getDay()) % 7));
    console.log("Encontrei próximo domingo");
  } else if (textoLower.includes("amanhã") || textoLower.includes("amanha")) {
    // Define para amanhã
    resultDate.setDate(today.getDate() + 1);
    console.log("Encontrei amanhã");
  }
  
  // Define a hora mencionada ou padrão
  if (textoLower.includes("10h") || textoLower.includes("10:00") || 
      textoLower.includes("às 10") || textoLower.includes("as 10")) {
    resultDate.setHours(10, 0, 0, 0);
    console.log("Horário definido para 10:00");
  } else if (textoLower.includes("15h") || textoLower.includes("15:00") || 
             textoLower.includes("às 15") || textoLower.includes("as 15") || 
             textoLower.includes("3 da tarde")) {
    resultDate.setHours(15, 0, 0, 0);
    console.log("Horário definido para 15:00");
  } else {
    resultDate.setHours(10, 0, 0, 0); // Hora padrão
    console.log("Nenhum horário específico encontrado, usando 10:00 como padrão");
  }
  
  console.log(`Data calculada: ${resultDate.toISOString()}`);
  return resultDate;
}

// Se executado diretamente, processa o texto fornecido como argumento
if (require.main === module) {
  const texto = process.argv[2] || "Agendar reunião com João na próxima sexta às 10h";
  processDate(texto);
}