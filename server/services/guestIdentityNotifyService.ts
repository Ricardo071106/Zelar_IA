import { storage, type UserGuestContactRow } from '../storage';
import { emailService } from './emailService';
import { getWhatsAppBot } from '../whatsapp/whatsappBot';

function displayNameFromRow(row: UserGuestContactRow): string {
  const a = (row.aliasNames ?? []).filter(Boolean);
  if (a.length) return a.join(', ');
  if (row.canonicalEmail) {
    return row.canonicalEmail.split('@')[0] || row.canonicalEmail;
  }
  if (row.guestPhoneE164) {
    return `WhatsApp ${row.guestPhoneE164}`;
  }
  return 'Convidado';
}

/**
 * Envia aviso único de que o contato foi incluído na planilha do anfitrião (painel).
 * Pode ser chamado pela API POST /api/panel/guests/notify quando necessário.
 */
export async function notifyPendingGuestIdentities(
  ownerUserId: number,
  hostLabel: string,
): Promise<{ emailed: number; whatsapped: number }> {
  const rows = await storage.listUserGuestContacts(ownerUserId);
  const pending = rows.filter((r) => !r.identityNotifiedAt);
  let emailed = 0;
  let whatsapped = 0;

  const bot = getWhatsAppBot();

  for (const row of pending) {
    const name = displayNameFromRow(row);
    const email = row.canonicalEmail;
    const phone = row.guestPhoneE164;

    const canWa = Boolean(phone && /^\d+$/.test(phone));
    const canEmail = Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (!canWa && !canEmail) {
      continue;
    }

    let delivered = false;

    if (canWa) {
      try {
        const jid = `${phone}@s.whatsapp.net`;
        await bot.sendMessage(
          jid,
          `👋 *Olá${name ? `, ${name}` : ''}!*\n\n` +
            `📇 *${hostLabel}* adicionou você à lista de convidados do *Zelar IA*.\n\n` +
            `Quando houver um evento com seu nome ou e-mail, você receberá o convite por aqui e/ou por e-mail.\n\n` +
            `_Mensagem automática do Zelar IA_`,
        );
        whatsapped += 1;
        delivered = true;
      } catch (e) {
        console.warn('[guestIdentityNotify] WhatsApp falhou para', phone, e);
      }
    }

    if (canEmail) {
      const ok = await emailService.sendEmail(
        email,
        `${hostLabel} adicionou você como convidado no Zelar IA`,
        `<p>Olá${name ? `, <strong>${escapeHtml(name)}</strong>` : ''}!</p>
         <p><strong>${escapeHtml(hostLabel)}</strong> incluiu seu e-mail na planilha de convidados do <strong>Zelar IA</strong>.</p>
         <p>Quando marcarem um evento com você, você poderá receber convites e lembretes por este e-mail.</p>
         <p><em>Mensagem automática — não responda.</em></p>`,
        undefined,
      );
      if (ok) {
        emailed += 1;
        delivered = true;
      }
    }

    if (delivered) {
      await storage.markGuestIdentityNotified(ownerUserId, row.id);
    }
  }

  return { emailed, whatsapped };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
