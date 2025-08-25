// Teste para verificar se o link mailto está sendo gerado corretamente

// Simular as funções do bot
function generateEmailLink(eventInfo, recipientEmail = '') {
  const startDate = new Date(eventInfo.date);
  const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
  
  const subject = encodeURIComponent(`Convite de Calendário: ${eventInfo.title}`);
  const body = encodeURIComponent(
    `Olá!\n\n` +
    `Você está convidado para:\n\n` +
    `📅 ${eventInfo.title}\n` +
    `📆 ${eventInfo.formattedDate}\n` +
    `⏰ ${eventInfo.formattedTime}\n\n` +
    `Este é um convite de calendário que pode ser adicionado diretamente ao seu calendário.\n\n` +
    `Atenciosamente,\nZelar Bot`
  );
  
  if (recipientEmail) {
    return `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
  } else {
    return `mailto:?subject=${subject}&body=${body}`;
  }
}

// Simular dados do evento
const eventInfo = {
  title: 'Almoço com Fred',
  date: new Date('2025-08-29T12:00:00.000Z'),
  formattedDate: 'sexta-feira, 29 de agosto de 2025',
  formattedTime: '12:00'
};

const recipientEmail = 'fred@maplink.global';

// Testar geração do link
const mailtoLink = generateEmailLink(eventInfo, recipientEmail);

console.log('🔗 Link Mailto gerado:');
console.log(mailtoLink);
console.log('\n📧 Verificação:');
console.log(`Contém mailto: ${mailtoLink.includes('mailto:')}`);
console.log(`Contém email: ${mailtoLink.includes(recipientEmail)}`);
console.log(`Contém subject: ${mailtoLink.includes('subject=')}`);
console.log(`Contém body: ${mailtoLink.includes('body=')}`);

// Testar formatação HTML
const emailLinks = `📧 <b>Enviar convite por email:</b>\n` +
                   `• <a href="https://mail.google.com/mail/u/0/#compose?to=${encodeURIComponent(recipientEmail)}&subject=test&body=test">📨 Gmail (com convite)</a>\n` +
                   `• <a href="${mailtoLink}">📧 Mailto (cliente padrão)</a>`;

console.log('\n📱 Formatação HTML:');
console.log(emailLinks);
console.log(`\nContém link mailto na resposta: ${emailLinks.includes('mailto:')}`);
