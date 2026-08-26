import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { AssetError, deleteTenantAsset, readTenantAsset } from '@/lib/db/tenantAssets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; assetId: string }> };

export async function GET(_request: Request, context: Context) {
  const { id, assetId } = await context.params;
  const auth = await requirePlatformSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;

  try {
    const asset = await readTenantAsset(id, assetId);
    return new NextResponse(new Uint8Array(asset.content), {
      headers: {
        'Content-Type': asset.contentType,
        'Content-Length': String(asset.content.length),
        // Always an attachment-safe disposition: tenant-supplied files are never
        // rendered as active content in the control-plane origin.
        'Content-Disposition': `inline; filename="${encodeURIComponent(asset.fileName)}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    if (error instanceof AssetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Unable to read tenant asset', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่านไฟล์ได้' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { id, assetId } = await context.params;
  const auth = await requirePlatformSession(id, 'STAFF');
  if (auth instanceof NextResponse) return auth;

  try {
    await deleteTenantAsset(id, assetId);
    await recordPlatformAudit({
      platformId: id,
      entityType: 'DATABASE',
      entityId: id,
      action: 'DELETE_ASSET',
      performedBy: auth.actor,
      changesSummary: `ลบไฟล์ ${assetId} ออกจาก Tenant Database`,
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AssetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Unable to delete tenant asset', error);
    return NextResponse.json({ error: 'ไม่สามารถลบไฟล์ได้' }, { status: 500 });
  }
}
