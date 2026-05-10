import { db } from '../db';
import { users, events, reminders, userGuestContacts } from '@shared/schema';
import { count, sql, gte, isNotNull } from 'drizzle-orm';

export type PublicOverview = {
  totals: {
    users: number;
    netNewUsers30d: number;
    activeChats: number;
    eventsCreated: number;
  };
  businessMetrics: { label: string; value: number }[];
  funnel: { stage: string; value: number }[];
  automation: {
    smartParserSuccess: number;
    aiFallbackUsage: number;
    calendarLinkClicks: number;
    averageAiLatencyMs: number;
  };
  topIntents: { intent: string; percentage: number }[];
  updatedAt: string;
};

function emptyOverview(): PublicOverview {
  const now = new Date().toISOString();
  return {
    totals: { users: 0, netNewUsers30d: 0, activeChats: 0, eventsCreated: 0 },
    businessMetrics: [],
    funnel: [],
    automation: {
      smartParserSuccess: 0,
      aiFallbackUsage: 0,
      calendarLinkClicks: 0,
      averageAiLatencyMs: 0,
    },
    topIntents: [],
    updatedAt: now,
  };
}

/**
 * Métricas públicas do site (painel /analytics) a partir do Postgres.
 */
export async function getPublicOverviewStats(): Promise<PublicOverview> {
  if (!db) {
    return emptyOverview();
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(users);
    const [{ newUsers }] = await db
      .select({ newUsers: count() })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo));

    const [{ totalEvents }] = await db.select({ totalEvents: count() }).from(events);
    const [{ events30 }] = await db
      .select({ events30: count() })
      .from(events)
      .where(gte(events.createdAt, thirtyDaysAgo));

    const [{ activeUsers30d }] = await db
      .select({
        activeUsers30d: sql<number>`count(distinct ${events.userId})::int`.mapWith(Number),
      })
      .from(events)
      .where(gte(events.createdAt, thirtyDaysAgo));

    const [{ synced }] = await db
      .select({ synced: count() })
      .from(events)
      .where(isNotNull(events.calendarId));

    const [{ withMeet }] = await db
      .select({ withMeet: count() })
      .from(events)
      .where(isNotNull(events.conferenceLink));

    const [{ guestRows }] = await db.select({ guestRows: count() }).from(userGuestContacts);
    const [{ reminderRows }] = await db.select({ reminderRows: count() }).from(reminders);

    const totalUsersN = Number(totalUsers);
    const totalEventsN = Number(totalEvents);
    const syncedN = Number(synced);

    const smartParserSuccess =
      totalEventsN > 0 ? Math.min(1, syncedN / totalEventsN) : 0;

    const topExec = await db.execute(sql`
      SELECT title, COUNT(*)::int AS cnt
      FROM events
      GROUP BY title
      ORDER BY cnt DESC
      LIMIT 4
    `);
    const topRows = Array.isArray(topExec)
      ? (topExec as { title: string; cnt: number }[])
      : ((topExec as { rows?: { title: string; cnt: number }[] }).rows ?? []);
    const sumTop = topRows.reduce((s, r) => s + Number(r.cnt), 0) || 1;
    const topIntents = topRows.map((r) => {
      const t = String(r.title ?? '');
      return {
        intent: t.length > 52 ? `${t.slice(0, 52)}…` : t,
        percentage: Number(r.cnt) / sumTop,
      };
    });

    const businessMetrics = [
      { label: 'Eventos no banco', value: totalEventsN },
      { label: 'Novos usuários (30 dias)', value: Number(newUsers) },
      { label: 'Contatos (planilha)', value: Number(guestRows) },
      { label: 'Lembretes agendados', value: Number(reminderRows) },
    ];

    const funnel = [
      { stage: 'Usuários cadastrados', value: totalUsersN },
      { stage: 'Eventos nos últimos 30 dias', value: Number(events30) },
      { stage: 'Sincronizados com calendário', value: syncedN },
      { stage: 'Com link de vídeo', value: Number(withMeet) },
    ];

    return {
      totals: {
        users: totalUsersN,
        netNewUsers30d: Number(newUsers),
        activeChats: Number(activeUsers30d),
        eventsCreated: totalEventsN,
      },
      businessMetrics,
      funnel,
      automation: {
        smartParserSuccess,
        aiFallbackUsage: 0,
        calendarLinkClicks: totalEventsN > 0 ? Math.min(1, Number(withMeet) / totalEventsN) : 0,
        averageAiLatencyMs: 0,
      },
      topIntents,
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('[publicStats] getPublicOverviewStats:', e);
    return emptyOverview();
  }
}
