import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { verifyPanelToken } from '../utils/panelToken';
import { storage } from '../storage';
import { COMMON_TIMEZONES } from '../services/dateService';
import { stripeService } from '../services/stripe';
import { notifyPendingGuestIdentities } from '../services/guestIdentityNotifyService';

const router = Router();

function extractToken(req: Request): string | undefined {
  const q = req.query.t;
  if (typeof q === 'string' && q) return q;
  const h = req.headers['x-panel-token'];
  if (typeof h === 'string' && h) return h;
  const body = req.body && typeof req.body === 'object' ? (req.body as any).t : undefined;
  if (typeof body === 'string' && body) return body;
  return undefined;
}

async function panelUser(req: Request): Promise<{ user: NonNullable<Awaited<ReturnType<typeof storage.getUser>>> } | null> {
  const payload = verifyPanelToken(extractToken(req));
  if (!payload) return null;
  const user = await storage.getUser(payload.u);
  if (!user || user.username !== payload.w) return null;
  return { user };
}

function displayNameFromAliases(aliasNames: string[] | null | undefined, email: string): string {
  const a = (aliasNames ?? []).filter(Boolean);
  if (a.length) return a.join(', ');
  return email.split('@')[0] || '';
}

router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const { user } = ctx;
    const settings = await storage.getUserSettings(user.id);
    const baseUrl = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
    const token = extractToken(req) || '';

    const nextReturn = `/painel?t=${encodeURIComponent(token)}`;
    const googleConnect =
      `${baseUrl}/api/auth/google/authorize?userId=${user.id}&platform=whatsapp&redirect=1&next=${encodeURIComponent(nextReturn)}`;
    const microsoftConnect =
      `${baseUrl}/api/auth/microsoft/authorize?userId=${user.id}&platform=whatsapp&redirect=1&next=${encodeURIComponent(nextReturn)}`;

    const stripePaymentLink = process.env.STRIPE_PAYMENT_LINK
      ? `${process.env.STRIPE_PAYMENT_LINK}?client_reference_id=${user.id}`
      : null;

    let stripeCheckoutUrl: string | null = null;
    try {
      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID) {
        const session = await stripeService.createCheckoutSession(user.id, user.email || undefined);
        stripeCheckoutUrl = session.url;
      }
    } catch (e) {
      console.warn('[panel] checkout session indisponivel:', e);
    }

    const calendarConnected =
      settings?.calendarProvider === 'google' && settings.googleTokens
        ? 'google'
        : settings?.calendarProvider === 'microsoft' && settings.microsoftTokens
          ? 'microsoft'
          : null;

    res.json({
      user: {
        id: user.id,
        phone: user.username,
        name: user.name,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndsAt: user.subscriptionEndsAt,
      },
      settings: {
        timeZone: settings?.timeZone || 'America/Sao_Paulo',
        calendarConnected,
      },
      timezones: COMMON_TIMEZONES,
      links: {
        googleConnect,
        microsoftConnect,
        stripePaymentLink,
        stripeCheckoutUrl,
      },
    });
  }),
);

router.patch(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const { user } = ctx;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const timeZone = typeof req.body?.timeZone === 'string' ? req.body.timeZone.trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'email obrigatorio e valido' });
    }

    await storage.updateUser(user.id, { email });

    if (timeZone) {
      const s = await storage.getUserSettings(user.id);
      if (s) {
        await storage.updateUserSettings(user.id, { timeZone });
      } else {
        await storage.createUserSettings({
          userId: user.id,
          notificationsEnabled: true,
          reminderTimes: [12],
          language: 'pt-BR',
          timeZone,
        });
      }
    }

    const updated = await storage.getUser(user.id);
    res.json({ ok: true, user: { id: updated?.id, email: updated?.email } });
  }),
);

router.post(
  '/calendar/disconnect',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    await storage.updateUserSettings(ctx.user.id, {
      googleTokens: null,
      microsoftTokens: null,
      calendarProvider: null,
    });
    res.json({ ok: true });
  }),
);

router.post(
  '/subscription/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    if (!req.body?.confirm) {
      return res.status(400).json({ error: 'confirmacao necessaria' });
    }
    try {
      const result = await stripeService.cancelSubscription(ctx.user.id);
      res.json({
        ok: true,
        endsAt: result.endsAt.toISOString(),
      });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || 'falha ao cancelar' });
    }
  }),
);

router.get(
  '/guests',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const rows = await storage.listUserGuestContacts(ctx.user.id);
    res.json({
      guests: rows.map((r) => ({
        id: r.id,
        name: displayNameFromAliases(r.aliasNames, r.canonicalEmail),
        email: r.canonicalEmail,
        phone: r.guestPhoneE164 || '',
      })),
    });
  }),
);

router.post(
  '/guests',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    const rawId = req.body?.id;
    const id =
      rawId === undefined || rawId === null || rawId === ''
        ? undefined
        : parseInt(String(rawId), 10);
    if (id !== undefined && Number.isNaN(id)) {
      return res.status(400).json({ error: 'id invalido' });
    }

    if (!email) {
      return res.status(400).json({ error: 'email obrigatorio' });
    }

    try {
      const row = await storage.upsertGuestFromPanel(ctx.user.id, {
        id,
        email,
        name: name || undefined,
        phone,
      });
      res.json({
        guest: {
          id: row.id,
          name: displayNameFromAliases(row.aliasNames, row.canonicalEmail),
          email: row.canonicalEmail,
          phone: row.guestPhoneE164 || '',
        },
      });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || 'falha ao salvar' });
    }
  }),
);

router.delete(
  '/guests/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: 'id invalido' });
    }
    const ok = await storage.deleteUserGuestContactById(ctx.user.id, id);
    if (!ok) {
      return res.status(404).json({ error: 'nao encontrado' });
    }
    res.json({ ok: true });
  }),
);

router.post(
  '/guests/notify',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const hostLabel = ctx.user.name || ctx.user.username || 'Anfitrião';
    const result = await notifyPendingGuestIdentities(ctx.user.id, hostLabel);
    res.json({ ok: true, ...result });
  }),
);

export default router;
