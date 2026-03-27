
import sgMail from '@sendgrid/mail';

const API_KEY = process.env.SENDGRID_API_KEY || '';

sgMail.setApiKey(API_KEY);

const msg = {
  to: 'zelar.ia.suporte@gmail.com', // Fallback
  from: process.env.SENDGRID_FROM_EMAIL || "zelar.ia.suporte@gmail.com",
  subject: 'Teste Simples SendGrid',
  text: 'Este é um teste simples para verificar a chave de API.',
  html: '<strong>Este é um teste simples para verificar a chave de API.</strong>',
};

console.log("🚀 Tentando enviar email com chave hardcoded...");

sgMail
  .send(msg)
  .then(() => {
    console.log('✅ Email enviado com sucesso!');
  })
  .catch((error) => {
    console.error('❌ Erro ao enviar email:');
    console.error(error);
    if (error.response) {
      console.error(error.response.body);
    }
  });
