
import sgMail from '@sendgrid/mail';
import 'dotenv/config';

console.log("🧪 Iniciando teste baseado no exemplo do usuário...");

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
  console.error("❌ SENDGRID_API_KEY não encontrada no .env");
  process.exit(1);
}

console.log(`🔑 Usando API Key: ${apiKey.substring(0, 5)}... (Length: ${apiKey.length})`);

sgMail.setApiKey(apiKey);

const msg = {
  to: process.env.SENDGRID_FROM_EMAIL || 'zelar.ia.suporte@gmail.com', // Usando email do .env ou fallback
  from: process.env.SENDGRID_FROM_EMAIL || 'zelar.ia.suporte@gmail.com', // Sender
  subject: 'Teste SendGrid - Zelar IA',
  text: 'Email de teste enviado pelo script de verificação.',
  html: '<strong>Email de teste enviado pelo script de verificação.</strong>',
};

console.log(`📧 Enviando de: ${msg.from} para: ${msg.to}`);

sgMail
  .send(msg)
  .then(() => {
    console.log('✅ Email sent (Sucesso!)');
  })
  .catch((error) => {
    console.error('❌ Erro ao enviar:');
    console.error(error);
    if (error.response) {
      console.error('🔍 Detalhes do erro:', JSON.stringify(error.response.body, null, 2));
    }
  });
