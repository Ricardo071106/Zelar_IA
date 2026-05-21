import { Router, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler';
import { sanitizePanelTokenQueryParam, signPanelToken, verifyPanelToken } from '../utils/panelToken';
import { hashPanelPassword, verifyPanelPassword, validateNewPanelPassword } from '../utils/panelPassword';
import { storage, type UserGuestContactRow } from '../storage';
import { isFullName, fullNameValidationMessage } from '../utils/fullName';
import { COMMON_TIMEZONES } from '../services/dateService';
import { stripeService } from '../services/stripe';
import { notifyPendingGuestIdentities } from '../services/guestIdentityNotifyService';
import { parseContactsFromSpreadsheetBuffer } from '../utils/spreadsheetContacts';
import {
  createPluggyConnectToken,
  extractConnectToken,
  pluggyCredentialsConfigured,
} from '../services/pluggy/pluggyApi';
import { computeGuestLessonFinancials, syncGuestFinancialState } from '../services/guestLessonFinancials';
import { reconcileGuestContactLessonPayments } from '../services/reconcileGuestLessonPayments';
import { getLessonDebtUnitCents } from '../services/pluggy/lessonUnitPrice';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

function guestPanelDto(
  r: UserGuestContactRow,
  fin: {
    pendingDebtCents: number;
    lessonBalanceCents: number;
    lessonNetBalanceCents: number;
  },
) {
  return {
    id: r.id,
    name: displayNameFromAliases(r.aliasNames, r.canonicalEmail, r.guestPhoneE164),
    email: r.canonicalEmail ?? '',
    phone: r.guestPhoneE164 || '',
    payerTaxIdMasked: r.payerTaxIdMasked || '',
    studentType: r.studentType ?? '',
    monthlyAmountCents: r.monthlyAmountCents ?? null,
    packageLessonsTotal: r.packageLessonsTotal ?? null,
    remainingLessons: r.remainingLessons ?? null,
    lessonBalanceCents: fin.lessonBalanceCents,
    lessonPendingDebtCents: fin.pendingDebtCents,
    lessonNetBalanceCents: fin.lessonNetBalanceCents,
    financialStatus: r.financialStatus ?? 'pendente',
    notes: r.notes ?? '',
  };
}

function extractToken(req: Request): string | undefined {
  const q = req.query.t;
  if (typeof q === 'string' && q) return sanitizePanelTokenQueryParam(q);
  const h = req.headers['x-panel-token'];
  if (typeof h === 'string' && h) return sanitizePanelTokenQueryParam(h);
  const body = req.body && typeof req.body === 'object' ? (req.body as any).t : undefined;
  if (typeof body === 'string' && body) return sanitizePanelTokenQueryParam(body);
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

function normalizePanelEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

type PanelLessonPackageRow = {
  slug: string;
  label: string;
  lessons: number;
  priceCents: number;
  sortOrder: number;
};

/** Valida o mesmo formato enviado pelo painel (id, label, lessons, priceCents). */
function normalizePanelLessonPackages(raw: unknown[] | null): PanelLessonPackageRow[] {
  if (raw == null || raw.length === 0) return [];
  const used = new Set<string>();
  const out: PanelLessonPackageRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i] as Record<string, unknown>;
    let slug = typeof o?.id === 'string' ? o.id.trim().slice(0, 64) : '';
    if (!slug) slug = `p${i + 1}`;
    const base = slug;
    let n = 0;
    while (used.has(slug)) {
      n++;
      slug = `${base.slice(0, 48)}_${n}`.slice(0, 64);
    }
    used.add(slug);
    const label = typeof o?.label === 'string' ? o.label.trim().slice(0, 256) : 'Pacote';
    const lessonsRaw = o?.lessons;
    const lessons =
      typeof lessonsRaw === 'number' && Number.isFinite(lessonsRaw)
        ? lessonsRaw
        : parseInt(String(lessonsRaw ?? '').trim(), 10);
    if (!Number.isFinite(lessons) || lessons < 1 || lessons > 999) {
      throw new Error(`Pacote «${label}»: número de aulas inválido`);
    }
    let priceCents = 0;
    if (typeof o?.priceCents === 'number' && Number.isFinite(o.priceCents)) {
      priceCents = Math.max(0, Math.floor(o.priceCents));
    }
    if (priceCents <= 0) {
      throw new Error(`Pacote «${label}»: preço inválido`);
    }
    out.push({ slug, label, lessons, priceCents, sortOrder: i });
  }
  return out;
}

router.post(
  '/auth/login',
  asyncHandler(async (req: Request, res: Response) => {
    const email = normalizePanelEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }
    const user = await storage.getUserByNormalizedEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.', code: 'auth_failed' });
    }
    if (!user.panelPasswordHash) {
      return res.status(403).json({
        error:
          'Você ainda não definiu uma senha para o painel. Abra o link «Criar senha» enviado pelo Zelar no WhatsApp.',
        code: 'senha_nao_cadastrada',
      });
    }
    if (!verifyPanelPassword(password, user.panelPasswordHash)) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.', code: 'auth_failed' });
    }
    try {
      const token = signPanelToken(user.id, user.username);
      res.json({ ok: true, token });
    } catch {
      res.status(503).json({ error: 'Servidor sem PANEL_TOKEN_SECRET configurado.' });
    }
  }),
);

router.post(
  '/auth/register',
  asyncHandler(async (req: Request, res: Response) => {
    const email = normalizePanelEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const rawT =
      typeof req.body?.t === 'string' && req.body.t.trim()
        ? req.body.t.trim()
        : typeof req.query.t === 'string' && req.query.t
          ? req.query.t
          : '';
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }
    if (!rawT) {
      return res.status(400).json({
        error:
          'Abra esta página pelo link «Criar senha» enviado pelo Zelar no WhatsApp (o link identifica sua conta).',
        code: 'token_obrigatorio',
      });
    }
    const pwdErr = validateNewPanelPassword(password);
    if (pwdErr) {
      return res.status(400).json({ error: pwdErr });
    }
    const payload = verifyPanelToken(rawT);
    if (!payload) {
      return res.status(401).json({ error: 'Link inválido ou expirado. Peça um novo no WhatsApp.', code: 'token_invalido' });
    }
    const user = await storage.getUser(payload.u);
    if (!user || user.username !== payload.w) {
      return res.status(401).json({ error: 'Link inválido para esta conta.', code: 'token_invalido' });
    }
    if (user.panelPasswordHash) {
      return res.status(409).json({
        error: 'Esta conta já possui senha. Use a tela de entrar com seu e-mail.',
        code: 'ja_registrado',
      });
    }
    const busy = await storage.existsOtherUserWithEmail(user.id, email);
    if (busy) {
      return res.status(409).json({
        error: 'Este e-mail já está em uso por outra conta.',
        code: 'email_em_uso',
      });
    }
    const hash = hashPanelPassword(password);
    await storage.updateUser(user.id, { email, panelPasswordHash: hash });
    try {
      const token = signPanelToken(user.id, user.username);
      res.json({ ok: true, token });
    } catch {
      res.status(503).json({ error: 'Servidor sem PANEL_TOKEN_SECRET configurado.' });
    }
  }),
);

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

    /** Não chama API Pluggy aqui — leitura de extrato só no WhatsApp com `/buscar` (evita tráfego Pluggy ao abrir o painel). */
    let pluggy: { itemId: string; label: string } | null = null;
    const pluggyItemId = settings?.pluggyItemId?.trim();
    if (pluggyItemId) {
      pluggy = { itemId: pluggyItemId, label: 'Conta conectada' };
    }

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
        pluggyItemId: settings?.pluggyItemId ?? null,
        defaultLessonPriceCents: settings?.defaultLessonPriceCents ?? null,
        lessonPackagesJson: settings?.lessonPackagesJson ?? null,
      },
      pluggy,
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
    const settings = await storage.getUserSettings(ctx.user.id);
    const def = settings?.defaultLessonPriceCents ?? null;
    const guests = await Promise.all(
      rows.map(async (r) => {
        const fin = await computeGuestLessonFinancials(ctx.user.id, r, def);
        return guestPanelDto(r, {
          pendingDebtCents: fin.pendingDebtCents,
          lessonBalanceCents: fin.lessonBalanceCents,
          lessonNetBalanceCents: fin.lessonNetBalanceCents,
        });
      }),
    );
    res.json({ guests });
  }),
);

router.get(
  '/lessons/pending',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }
    const rows = await storage.listUserGuestContacts(ctx.user.id);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const settings = await storage.getUserSettings(ctx.user.id);
    const def = settings?.defaultLessonPriceCents ?? null;

    const pendingEvents = await storage.listPendingLessonEventsForUserOrdered(ctx.user.id, 2500, true);

    const lessons = pendingEvents
      .filter((ev) => ev.studentContactId != null && byId.has(ev.studentContactId))
      .map((ev) => {
        const cid = ev.studentContactId!;
        const contact = byId.get(cid)!;
        const unit = getLessonDebtUnitCents(ev, contact, def);
        const studentName = displayNameFromAliases(contact.aliasNames, contact.canonicalEmail, contact.guestPhoneE164);
        return {
          id: ev.id,
          title: ev.title,
          startDate: (ev.startDate instanceof Date ? ev.startDate : new Date(ev.startDate as string)).toISOString(),
          studentContactId: cid,
          studentName,
          status: ev.lessonPaymentStatus,
          unitCents: unit ?? null,
        };
      });

    lessons.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    res.json({ lessons });
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
    const payerTaxId =
      Object.prototype.hasOwnProperty.call(req.body || {}, 'payerTaxId')
        ? typeof req.body?.payerTaxId === 'string'
          ? req.body.payerTaxId.trim()
          : req.body?.payerTaxId == null
            ? null
            : String(req.body.payerTaxId).trim()
        : undefined;
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
      let oldGuest: UserGuestContactRow | undefined;
      if (id !== undefined) {
        oldGuest = await storage.getGuestContactByIdForUser(ctx.user.id, id);
      }
      const settingsForFreeze = await storage.getUserSettings(ctx.user.id);

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
      let lessonBalanceCents: number | null | undefined = undefined;
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'lessonBalanceCents')) {
        const lb = (req.body as any).lessonBalanceCents;
        if (lb === undefined) lessonBalanceCents = undefined;
        else if (lb === null || lb === '') lessonBalanceCents = 0;
        else if (typeof lb === 'number' && Number.isFinite(lb)) lessonBalanceCents = Math.round(lb);
        else lessonBalanceCents = Math.round(parseMoneyToCentsFromPanel(lb) ?? 0);
      }

      if (oldGuest && id !== undefined) {
        const monthlyChanged =
          monthlyAmountCents !== undefined &&
          (oldGuest.monthlyAmountCents ?? null) !== (monthlyAmountCents ?? null);
        const pkgChanged =
          packageLessonsTotal !== undefined &&
          (oldGuest.packageLessonsTotal ?? null) !== (packageLessonsTotal ?? null);
        if (monthlyChanged || pkgChanged) {
          const { freezePendingLessonSnapshotsBeforeGuestPricingChange } = await import(
            '../services/lessonPriceSnapshotFreeze',
          );
          await freezePendingLessonSnapshotsBeforeGuestPricingChange(
            ctx.user.id,
            id,
            oldGuest,
            settingsForFreeze?.defaultLessonPriceCents ?? null,
          );
        }
      }

      const row = await storage.upsertGuestFromPanel(ctx.user.id, {
        id,
        email,
        name,
        phone,
        payerTaxId,
        studentType: studentType || undefined,
        notes: notes || undefined,
        financialStatus: financialStatus || undefined,
        monthlyAmountCents,
        packageLessonsTotal,
        remainingLessons,
        lessonBalanceCents,
      });
      await reconcileGuestContactLessonPayments(ctx.user.id, row.id, { paymentSource: 'balance' });
      const freshAfter = await storage.getGuestContactByIdForUser(ctx.user.id, row.id);
      const settingsAfter = await storage.getUserSettings(ctx.user.id);
      const fin = await computeGuestLessonFinancials(
        ctx.user.id,
        freshAfter ?? row,
        settingsAfter?.defaultLessonPriceCents ?? null,
      );
      res.json({
        guest: guestPanelDto(freshAfter ?? row, {
          pendingDebtCents: fin.pendingDebtCents,
          lessonBalanceCents: fin.lessonBalanceCents,
          lessonNetBalanceCents: fin.lessonNetBalanceCents,
        }),
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
    const { rows, sourceRowCount, headerRowIndex, usedHeuristic } =
      parseContactsFromSpreadsheetBuffer(file.buffer);
    let imported = 0;
    const errors: { line: number; error: string; code?: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const line = r.sourceLine ?? i + 1;
      const nameTrim = (r.name ?? '').trim();
      const hasEmail = !!(r.email?.trim());
      const hasPhone = !!(r.phone?.trim());

      if (!nameTrim) {
        errors.push({
          line,
          code: 'nome_obrigatorio',
          error: 'Informe o nome na coluna de nome.',
        });
        continue;
      }
      if (!isFullName(nameTrim)) {
        errors.push({
          line,
          code: 'nome_incompleto',
          error:
            'Nome sem sobrenome: inclua nome e sobrenome na planilha (cada parte com pelo menos 2 letras). Salve o arquivo e importe de novo.',
        });
        continue;
      }
      if (!hasEmail && !hasPhone) {
        errors.push({
          line,
          code: 'sem_contato',
          error: 'Informe pelo menos e-mail ou telefone nesta linha.',
        });
        continue;
      }
      try {
        await storage.upsertGuestFromPanel(ctx.user.id, {
          email: r.email?.trim() || '',
          name: nameTrim,
          phone: r.phone,
        });
        imported++;
      } catch (e: any) {
        const msg = e?.message || 'falha';
        const code =
          msg.includes('telefone invalido') || msg.includes('telefone inválido')
            ? 'telefone_invalido'
            : msg.includes('email invalido') || msg.includes('email inválido')
              ? 'email_invalido'
              : 'import_error';
        errors.push({ line, code, error: msg });
      }
    }
    res.json({
      ok: true,
      imported,
      parsed: rows.length,
      sourceRowCount,
      headerRowIndex,
      usedHeuristic,
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

router.patch(
  '/settings/finance',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }

    let defaultLessonPriceCents: number | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'defaultLessonPriceReais')) {
      const raw = (req.body as { defaultLessonPriceReais?: unknown }).defaultLessonPriceReais;
      if (raw === '' || raw === null || raw === undefined) defaultLessonPriceCents = null;
      else {
        try {
          defaultLessonPriceCents = parseMoneyToCentsFromPanel(raw);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'preco da aula invalido';
          return res.status(400).json({ error: msg });
        }
      }
    }

    let lessonPackagesJson: unknown | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'lessonPackagesJson')) {
      const raw = (req.body as { lessonPackagesJson?: unknown }).lessonPackagesJson;
      if (raw === null || raw === '') lessonPackagesJson = null;
      else if (typeof raw === 'string') {
        try {
          lessonPackagesJson = JSON.parse(raw) as unknown;
        } catch {
          return res.status(400).json({ error: 'lessonPackagesJson JSON invalido' });
        }
      } else {
        lessonPackagesJson = raw;
      }
      if (lessonPackagesJson != null && !Array.isArray(lessonPackagesJson)) {
        return res.status(400).json({ error: 'lessonPackagesJson deve ser um array' });
      }
    }

    let pluggyItemId: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'pluggyItemId')) {
      const v = (req.body as { pluggyItemId?: unknown }).pluggyItemId;
      pluggyItemId = v == null || v === '' ? null : String(v).trim().slice(0, 128);
    }

    const s = await storage.getUserSettings(ctx.user.id);
    const patch: {
      defaultLessonPriceCents?: number | null;
      lessonPackagesJson?: unknown | null;
      pluggyItemId?: string | null;
    } = {};
    if (defaultLessonPriceCents !== undefined) patch.defaultLessonPriceCents = defaultLessonPriceCents;

    let normalizedPackageRows: PanelLessonPackageRow[] | undefined;
    if (lessonPackagesJson !== undefined) {
      try {
        normalizedPackageRows = normalizePanelLessonPackages(lessonPackagesJson as unknown[] | null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'lessonPackagesJson invalido';
        return res.status(400).json({ error: msg });
      }
      patch.lessonPackagesJson =
        normalizedPackageRows.length > 0
          ? normalizedPackageRows.map((n) => ({
              id: n.slug,
              label: n.label,
              lessons: n.lessons,
              priceCents: n.priceCents,
            }))
          : null;
    }
    if (pluggyItemId !== undefined) patch.pluggyItemId = pluggyItemId;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'nada para atualizar' });
    }

    if (
      defaultLessonPriceCents !== undefined &&
      s &&
      s.defaultLessonPriceCents !== defaultLessonPriceCents
    ) {
      const { freezeLessonUnitSnapshotsBeforeDefaultPriceChange } = await import(
        '../services/lessonPriceSnapshotFreeze',
      );
      await freezeLessonUnitSnapshotsBeforeDefaultPriceChange(ctx.user.id, s.defaultLessonPriceCents);
    }

    if (s) {
      await storage.updateUserSettings(ctx.user.id, patch);
    } else {
      await storage.createUserSettings({
        userId: ctx.user.id,
        notificationsEnabled: true,
        reminderTimes: [12],
        language: 'pt-BR',
        timeZone: 'America/Sao_Paulo',
        ...patch,
      });
    }

    if (normalizedPackageRows !== undefined) {
      try {
        await storage.replaceUserLessonPackages(ctx.user.id, normalizedPackageRows);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[panel] settings/finance: user_lesson_packages nao gravado (continua em user_settings):', msg);
      }
    }

    const next = await storage.getUserSettings(ctx.user.id);
    res.json({
      ok: true,
      finance: {
        pluggyItemId: next?.pluggyItemId ?? null,
        defaultLessonPriceCents: next?.defaultLessonPriceCents ?? null,
        lessonPackagesJson: next?.lessonPackagesJson ?? null,
      },
    });
  }),
);

router.post(
  '/pluggy/connect-token',
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = await panelUser(req);
    if (!ctx) {
      return res.status(401).json({ error: 'token invalido ou expirado' });
    }

    if (!pluggyCredentialsConfigured()) {
      return res.status(503).json({
        error:
          'Pluggy: configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET (recomendado, como no quickstart oficial) ou PLUGGY_API_KEY no servidor',
      });
    }

    try {
      const baseUrl = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
      const webhookUrl = `${baseUrl}/api/pluggy/webhook`;
      const tokenQ = extractToken(req);
      // `pluggy_oauth=1` primeiro: a Pluggy costuma acrescentar `?itemId=`; assim o próximo parâmetro vira `&itemId=`
      // e o token `t` não é corrompido (evita 401 no /api/panel/me após o redirect).
      const oauthRedirectUri =
        typeof req.body?.oauthRedirectUri === 'string' && req.body.oauthRedirectUri.trim()
          ? String(req.body.oauthRedirectUri).trim()
          : `${baseUrl}/painel?pluggy_oauth=1${tokenQ ? `&t=${encodeURIComponent(tokenQ)}` : ''}`;

      const data = await createPluggyConnectToken({
        clientUserId: `zelar-user-${ctx.user.id}`,
        webhookUrl,
        oauthRedirectUri,
      });
      const connectToken = extractConnectToken(data);
      if (!connectToken) {
        return res.status(502).json({ error: 'resposta Pluggy sem connect token' });
      }
      res.json({ ok: true, connectToken });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'falha Pluggy';
      res.status(502).json({ error: msg });
    }
  }),
);

export default router;
