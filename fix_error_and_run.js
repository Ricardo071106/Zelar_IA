/**
 * Script simples para corrigir o erro e executar o bot
 */

// Importar módulos do Node.js
const fs = require('fs');
const { execSync } = require('child_process');

// Caminho do arquivo com problemas
const filePath = './server/simple_telegram_bot.ts';

try {
  // Tentar corrigir o arquivo
  console.log('Tentando corrigir o arquivo simples_telegram_bot.ts...');
  
  // Ler o conteúdo atual
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Verificar por chaves extras
  const matches = content.match(/}\s*}/g);
  if (matches) {
    console.log(`Encontradas ${matches.length} ocorrências de "} }"!`);
    
    // Substituir por uma única chave
    content = content.replace(/}\s*}/g, '}');
    
    // Salvar as alterações
    fs.writeFileSync(filePath, content);
    console.log('Arquivo corrigido com sucesso!');
  } else {
    console.log('Nenhum problema encontrado no formato do arquivo.');
  }
  
  // Agora executar nosso bot universal
  console.log('\nExecutando o bot com solução universal de calendário...');
  console.log('Esta solução não depende de senhas de aplicativo do Gmail!\n');
  
  // Executar o script MJS
  execSync('node run_universal_bot.mjs', { stdio: 'inherit' });
  
} catch (error) {
  console.error('Erro:', error.message);
}