import { NextRequest, NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getTenantDbByName, tenantDatabaseName } from '@/lib/db/tenantDb';
import { enforceRateLimit, clientIdentity } from '@/lib/security/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Visit counter for a published site.
 *
 * Counting happens here rather than through a third-party tag: a government
 * site should not hand its readers to an analytics vendor to show a number in
 * its own footer. Only per-day totals are kept — no identifier, no path, and
 * nothing that could reconstruct one person's browsing.
 *
 * A repeat within the same day from the same browser is not counted twice; that
 * is decided by a cookie the browser sends back, which stores no identity.
 */

const COOKIE = 'gov_seen';

async function tenantPool(appSlug: string) {
  const app = await getCoreDb().query<{ platform_slug: string }>(
    `SELECT p.platform_slug FROM public.apps a
     JOIN public.platforms p ON p.id = a.platform_id
     WHERE a.app_slug = $1 AND a.is_active`,
    [appSlug],
  );
  if (!app.rowCount) return null;
  return getTenantDbByName(tenantDatabaseName(app.rows[0].platform_slug));
}

async function ensureTable(pool: Awaited<ReturnType<typeof getTenantDbByName>>) {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS sys;
    CREATE TABLE IF NOT EXISTS sys.site_visits (
      visited_on DATE PRIMARY KEY,
      visits BIGINT NOT NULL DEFAULT 0
    );
  `);
}

interface Totals {
  today: number;
  yesterday: number;
  month: number;
  total: number;
}

async function readTotals(pool: Awaited<ReturnType<typeof getTenantDbByName>>): Promise<Totals> {
  const result = await pool.query<Record<string, string>>(`
    SELECT
      COALESCE((SELECT visits FROM sys.site_visits WHERE visited_on = CURRENT_DATE), 0)::text            AS today,
      COALESCE((SELECT visits FROM sys.site_visits WHERE visited_on = CURRENT_DATE - 1), 0)::text        AS yesterday,
      COALESCE((SELECT SUM(visits) FROM sys.site_visits
                WHERE visited_on >= date_trunc('month', CURRENT_DATE)), 0)::text                          AS month,
      COALESCE((SELECT SUM(visits) FROM sys.site_visits), 0)::text                                        AS total
  `);
  const row = result.rows[0] ?? {};
  return {
    today: Number(row.today ?? 0),
    yesterday: Number(row.yesterday ?? 0),
    month: Number(row.month ?? 0),
    total: Number(row.total ?? 0),
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  try {
    const pool = await tenantPool(appSlug);
    if (!pool) return NextResponse.json({ error: 'ไม่พบเว็บไซต์' }, { status: 404 });
    await ensureTable(pool);
    return NextResponse.json({ visits: await readTotals(pool) });
  } catch (error) {
    console.error(`[visits] unable to read totals for '${appSlug}'`, error);
    return NextResponse.json({ error: 'อ่านสถิติไม่ได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;

  // The endpoint is public, so it is rate limited like any other public write.
  const limited = await enforceRateLimit('public_write', clientIdentity(request, `visit:${appSlug}`));
  if (limited) return limited;

  try {
    const pool = await tenantPool(appSlug);
    if (!pool) return NextResponse.json({ error: 'ไม่พบเว็บไซต์' }, { status: 404 });
    await ensureTable(pool);

    const today = new Date().toISOString().slice(0, 10);
    const alreadySeen = request.cookies.get(COOKIE)?.value === today;

    if (!alreadySeen) {
      await pool.query(
        `INSERT INTO sys.site_visits (visited_on, visits) VALUES (CURRENT_DATE, 1)
         ON CONFLICT (visited_on) DO UPDATE SET visits = sys.site_visits.visits + 1`,
      );
    }

    const response = NextResponse.json({ visits: await readTotals(pool) });
    if (!alreadySeen) {
      response.cookies.set(COOKIE, today, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // Expires at the end of the day, so tomorrow counts again.
        maxAge: 60 * 60 * 24,
      });
    }
    return response;
  } catch (error) {
    console.error(`[visits] unable to record a visit for '${appSlug}'`, error);
    return NextResponse.json({ error: 'บันทึกสถิติไม่ได้' }, { status: 500 });
  }
}
