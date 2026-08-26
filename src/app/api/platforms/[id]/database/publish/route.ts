import { NextResponse } from 'next/server';
import { publishTenantStructure } from '@/lib/db/publishTenantStructure';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'APP_OWNER', 'DEVELOPER');
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await publishTenantStructure(id);
    await recordPlatformAudit({
      platformId: id,
      entityType: 'DATABASE',
      entityId: id,
      action: 'PUBLISH_DATABASE',
      performedBy: auth.actor,
      changesSummary: `Publish โครงสร้าง ${result.tables.length} ตารางไปยัง ${result.database} (revision ${result.revision})`,
      snapshotAfter: result as unknown as Record<string, unknown>,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Unable to publish tenant structure', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish failed' },
      { status: 500 },
    );
  }
}
