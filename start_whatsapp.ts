/**
 * Script para inicializar e configurar WhatsApp Business com Evolution API
 * Execute: npm run whatsapp
 */

import { setupEvolutionAPI, setupWhatsAppWebhook, checkInstanceStatus } from './server/whatsapp/evolutionBot';

async function main() {
  console.log('🚀 Iniciando configuração WhatsApp Business...\n');

  // Verificar variáveis de ambiente
  const requiredEnvs = ['EVOLUTION_API_URL', 'EVOLUTION_INSTANCE_NAME', 'EVOLUTION_API_KEY'];
  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

  if (missingEnvs.length > 0) {
    console.log('❌ Variáveis de ambiente obrigatórias não configuradas:');
    missingEnvs.forEach(env => console.log(`   - ${env}`));
    console.log('\n📝 Configure as variáveis no arquivo .env:');
    console.log('EVOLUTION_API_URL=https://sua-api.evolution.com');
    console.log('EVOLUTION_INSTANCE_NAME=sua-instancia');
    console.log('EVOLUTION_API_KEY=sua-api-key');
    console.log('\n💡 Ou use o painel admin em: http://localhost:5000/whatsapp');
    process.exit(1);
  }

  try {
    // 1. Configurar Evolution API
    console.log('🔧 Configurando Evolution API...');
    const setupSuccess = setupEvolutionAPI(
      process.env.EVOLUTION_API_URL!,
      process.env.EVOLUTION_INSTANCE_NAME!,
      process.env.EVOLUTION_API_KEY!
    );

    if (!setupSuccess) {
      console.log('❌ Falha ao configurar Evolution API');
      process.exit(1);
    }

    // 2. Verificar status da instância
    console.log('📱 Verificando status da instância...');
    const status = await checkInstanceStatus();

    if (status.connected) {
      console.log('✅ WhatsApp já conectado!');
    } else {
      console.log('⚠️  WhatsApp não conectado');
      
      if (status.qrCode) {
        console.log('📱 QR Code disponível no painel admin');
        console.log('🌐 Acesse: http://localhost:5000/whatsapp');
      }
    }

    // 3. Configurar webhook automaticamente
    const webhookUrl = process.env.WEBHOOK_URL || 'https://sua-app.replit.app/api/whatsapp/webhook';
    console.log('🔗 Configurando webhook...');
    
    const webhookSuccess = await setupWhatsAppWebhook(webhookUrl);
    
    if (webhookSuccess) {
      console.log('✅ Webhook configurado com sucesso');
    } else {
      console.log('⚠️  Configure o webhook manualmente no painel admin');
    }

    console.log('\n🎉 Configuração concluída!');
    console.log('🌐 Painel de administração: http://localhost:5000/whatsapp');
    console.log('📱 Bot Telegram: Já funcionando');
    console.log('📱 Bot WhatsApp: ' + (status.connected ? 'Funcionando' : 'Aguardando conexão'));
    
    console.log('\n💡 Teste enviando mensagens como:');
    console.log('   "me lembre de ligar para João amanhã às 15h"');
    console.log('   "reunião com cliente sexta às 10"');

  } catch (error) {
    console.error('❌ Erro durante configuração:', error);
    console.log('\n💡 Use o painel admin em: http://localhost:5000/whatsapp');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}