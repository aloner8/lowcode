import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { insertTenantRecord, listTenantRecords, TenantRecordError } from '@/lib/db/tenantRecords';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string; table: string }> };

interface AccessPolicy {
  readable: string[];
  insertable: string[];
}

/**
 * Unauthenticated data access for a published tenant site.
 *
 * Visitors of a public site have no platform session, so access is governed by
 * the platform's explicit `public_data_access` allow-list. Anything not listed
 * is refused, and anonymous callers can never UPDATE or DELETE.
 */
async function resolvePlatform(slug: string): Promise<{ id: string; policy: AccessPolicy } | null> {
  const result = await getCoreDb().query<{ id: string; public_data_access: AccessPolicy }>(
    'SELECT id, public_data_access FROM public.platforms WHERE platform_slug = $1',
    [slug],
  );
  if (!result.rowCount) return null;
  const policy = result.rows[0].public_data_access ?? { readable: [], insertable: [] };
  return {
    id: result.rows[0].id,
    policy: {
      readable: Array.isArray(policy.readable) ? policy.readable : [],
      insertable: Array.isArray(policy.insertable) ? policy.insertable : [],
    },
  };
}

const failure = (error: unknown) => {
  if (error instanceof TenantRecordError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('Public runtime data access failed', error);
  return NextResponse.json({ error: 'ไม่สามารถดำเนินการกับข้อมูลได้' }, { status: 500 });
};

export async function GET(request: Request, context: Context) {
  const { slug, table } = await context.params;
  const platform = await resolvePlatform(slug);
  if (!platform) return NextResponse.json({ error: 'ไม่พบ Site ที่ระบุ' }, { status: 404 });

  if (!platform.policy.readable.includes(table)) {
    return NextResponse.json({ error: `ตาราง '${table}' ไม่ได้เปิดให้อ่านแบบสาธารณะ` }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;

  try {
    const page = await listTenantRecords(platform.id, table, {
      limit: Math.min(Number(params.get('limit') ?? 20), 100),
      offset: Number(params.get('offset') ?? 0),
      orderBy: params.get('orderBy') ?? undefined,
      direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
      search: params.get('search') ?? undefined,
    });
    return NextResponse.json(page);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: Context) {
  const { slug, table } = await context.params;
  const platform = await resolvePlatform(slug);
  if (!platform) return NextResponse.json({ error: 'ไม่พบ Site ที่ระบุ' }, { status: 404 });

  if (!platform.policy.insertable.includes(table)) {
    return NextResponse.json({ error: `ตาราง '${table}' ไม่ได้เปิดให้บันทึกแบบสาธารณะ` }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const row = await insertTenantRecord(platform.id, table, body);

    await recordPlatformAudit({
      platformId: platform.id,
      entityType: 'DATABASE',
      entityId: platform.id,
      action: 'RECORD_INSERT',
      performedBy: `public:${slug}`,
      changesSummary: `ผู้ใช้สาธารณะบันทึกข้อมูลลงตาราง ${table}`,
    });

    return NextResponse.json({ record: row }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
