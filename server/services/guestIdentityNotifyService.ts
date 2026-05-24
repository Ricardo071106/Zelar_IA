import { storage, type UserGuestContactRow } from '../storage';
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
): Promise<{ whatsapped: number }> {
  const rows = await storage.listUserGuestContacts(ownerUserId);
  const pending = rows.filter((r) => !r.identityNotifiedAt);
  let whatsapped = 0;

  const bot = getWhatsAppBot();

  for (const row of pending) {
    const name = displayNameFromRow(row);
    const phone = row.guestPhoneE164;

    const canWa = Boolean(phone && /^\d+$/.test(phone));
    if (!canWa) {
      continue;
    }

    let delivered = false;

    try {
      const jid = `${phone}@s.whatsapp.net`;
      await bot.sendMessage(
        jid,
        `👋 *Olá${name ? `, ${name}` : ''}!*\n\n` +
          `📇 *${hostLabel}* adicionou você à lista de convidados do *Zelar IA*.\n\n` +
          `Quando houver um evento com seu nome ou e-mail, você receberá o convite por aqui.\n\n` +
          `_Mensagem automática do Zelar IA_`,
      );
      whatsapped += 1;
      delivered = true;
    } catch (e) {
      console.warn('[guestIdentityNotify] WhatsApp falhou para', phone, e);
    }

    if (delivered) {
      await storage.markGuestIdentityNotified(ownerUserId, row.id);
    }
  }

  return { whatsapped };
}
