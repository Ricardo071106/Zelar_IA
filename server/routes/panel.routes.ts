import { Router, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler';
import { verifyPanelToken } from '../utils/panelToken';
import { storage } from '../storage';
import { isFullName, fullNameValidationMessage } from '../utils/fullName';
import { COMMON_TIMEZONES } from '../services/dateService';
import { stripeService } from '../services/stripe';
import { notifyPendingGuestIdentities } from '../services/guestIdentityNotifyService';
import { parseContactsFromSpreadsheetBuffer } from '../utils/spreadsheetContacts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

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

function displayNameFromAliases(
  aliasNames: string[] | null | undefined,
  canonicalEmail: string | null | undefined,
  guestPhone?: string | null,
): string {
  const a = (aliasNames ?? []).filter(Boolean);
  if (a.length) return a.join(', ');
  if (canonicalEmail) return canonicalEmail.split('@')[0] || canonicalEmail;
  if (guestPhone) return `WhatsApp ${guestPhone}`;
  return 'Aluno';
}

/** string vazio → null; undefined → não enviar ao storage */
function parseMoneyToCentsFromPanel(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const s = typeof raw === 'number' ? String(raw) : String(raw).trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('valor mensal invalido');
  }
  return Math.round(n * 100);
}

function parseOptionalInt(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) throw new Error('numero invalido');
  return n;
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
        name: displayNameFromAliases(r.aliasNames, r.canonicalEmail, r.guestPhoneE164),
        email: r.canonicalEmail ?? '',
        phone: r.guestPhoneE164 || '',
        studentType: r.studentType ?? '',
        monthlyAmountCents: r.monthlyAmountCents ?? null,
        packageLessonsTotal: r.packageLessonsTotal ?? null,
        remainingLessons: r.remainingLessons ?? null,
        financialStatus: r.financialStatus ?? 'pendente',
        notes: r.notes ?? '',
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
    const studentType = typeof req.body?.studentType === 'string' ? req.body.studentType.trim() : '';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const financialStatus =
      typeof req.body?.financialStatus === 'string' ? req.body.financialStatus.trim() : '';
    const rawId = req.body?.id;
    const id =
      rawId === undefined || rawId === null || rawId === ''
        ? undefined
        : parseInt(String(rawId), 10);
    if (id !== undefined && Number.isNaN(id)) {
      return res.status(400).json({ error: 'id invalido' });
    }

    const hasEmail = email.length > 0;
    const hasPhone = typeof phone === 'string' && phone.trim().length > 0;
    if (id === undefined && !hasEmail && !hasPhone) {
      return res.status(400).json({ error: 'informe email ou telefone' });
    }

    if (!isFullName(name)) {
      return res.status(400).json({ error: fullNameValidationMessage() });
    }

    try {
      let monthlyAmountCents: number | null | undefined = undefined;
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'monthlyAmountReais')) {
        monthlyAmountCents = parseMoneyToCentsFromPanel((req.body as any).monthlyAmountReais);
      } else if (Object.prototype.hasOwnProperty.call(req.body || {}, 'monthlyAmountCents')) {
        const mc = (req.body as any).monthlyAmountCents;
        if (mc === undefined) monthlyAmountCents = undefined;
        else if (mc === null || mc === '') monthlyAmountCents = null;
        else if (typeof mc === 'number' && Number.isFinite(mc)) monthlyAmountCents = Math.round(mc);
        else monthlyAmountCents = parseMoneyToCentsFromPanel(mc);
      }

      const packageLessonsTotal = parseOptionalInt((req.body as any)?.packageLessonsTotal);
      const remainingLessons = parseOptionalInt((req.body as any)?.remainingLessons);

      const row = await storage.upsertGuestFromPanel(ctx.user.id, {
        id,
        email,
        name,
        phone,
        studentType: studentType || undefined,
        notes: notes || undefined,
        financialStatus: financialStatus || undefined,
        monthlyAmountCents,
        packageLessonsTotal,
        remainingLessons,
      });
      res.json({
        guest: {
          id: row.id,
          name: displayNameFromAliases(row.aliasNames, row.canonicalEmail, row.guestPhoneE164),
          email: row.canonicalEmail ?? '',
          phone: row.guestPhoneE164 || '',
          studentType: row.studentType ?? '',
          monthlyAmountCents: row.monthlyAmountCents ?? null,
          packageLessonsTotal: row.packageLessonsTotal ?? null,
          remainingLessons: row.remainingLessons ?? null,
          financialStatus: row.financialStatus ?? 'pendente',
          notes: row.notes ?? '',
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

router.post(
  '/guests/import',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const file = (req as Request & { file?: { buffer: Buffer; originalname: string } }).file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ error: 'envie um arquivo .xlsx, .xls ou .csv' });
    }
    const lower = (file.originalname || '').toLowerCase();
    if (!/\.(xlsx|xls|csv)$/.test(lower)) {
      return res.status(400).json({ error: 'use extensao .xlsx, .xls ou .csv' });
    }
    const { rows, sourceRowCount } = parseContactsFromSpreadsheetBuffer(file.buffer);
    let imported = 0;
    const errors: { line: number; error: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.name || !isFullName(r.name)) {
        errors.push({ line: i + 1, error: fullNameValidationMessage() });
        continue;
      }
      try {
        await storage.upsertGuestFromPanel(ctx.user.id, {
          email: r.email?.trim() || '',
          name: r.name,
          phone: r.phone,
        });
        imported++;
      } catch (e: any) {
        errors.push({ line: i + 1, error: e?.message || 'falha' });
      }
    }
    res.json({
      ok: true,
      imported,
      parsed: rows.length,
      sourceRowCount,
      errors,
    });
  }),
);

router.get(
  '/groups',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const groups = await storage.listUserContactGroupsWithMembers(ctx.user.id);
    res.json({
      groups: groups.map((g) => ({ id: g.id, name: g.name, contactIds: g.contactIds })),
    });
  }),
);

router.post(
  '/groups',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const raw = req.body?.contactIds;
    const contactIds = Array.isArray(raw) ? raw.map((x: unknown) => parseInt(String(x), 10)).filter((n) => !Number.isNaN(n)) : [];
    try {
      const { id } = await storage.createUserContactGroup(ctx.user.id, name, contactIds);
      res.json({ ok: true, id });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || 'falha ao criar grupo' });
    }
  }),
);

router.patch(
  '/groups/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: 'id invalido' });
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const raw = req.body?.contactIds;
    const contactIds = Array.isArray(raw)
      ? raw.map((x: unknown) => parseInt(String(x), 10)).filter((n) => !Number.isNaN(n))
      : undefined;
    if (name === undefined && contactIds === undefined) {
      return res.status(400).json({ error: 'nada para atualizar' });
    }
    try {
      await storage.updateUserContactGroup(ctx.user.id, id, { name, contactIds });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || 'falha ao atualizar' });
    }
  }),
);

router.delete(
  '/groups/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: 'id invalido' });
    }
    const ok = await storage.deleteUserContactGroup(ctx.user.id, id);
    if (!ok) {
      return res.status(404).json({ error: 'nao encontrado' });
    }
    res.json({ ok: true });
  }),
);

export default router;
