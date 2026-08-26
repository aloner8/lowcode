import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { AssetError, listTenantAssets, MAX_UPLOAD_BYTES, storeTenantAsset } from '@/lib/db/tenantAssets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'APP_VIEWER');
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ assets: await listTenantAssets(id), maxBytes: MAX_UPLOAD_BYTES });
  } catch (error) {
    console.error('Unable to list tenant assets', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่านรายการไฟล์ได้' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'APP_EDITOR', 'DEVELOPER');
  if (auth instanceof NextResponse) return auth;

  try {
    const form = await request.formData();
    const uploads = form.getAll('file').filter((entry): entry is File => entry instanceof File);
    if (!uploads.length) return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 });

    const assets = [];
    for (const upload of uploads) {
      const bytes = Buffer.from(await upload.arrayBuffer());
      assets.push(await storeTenantAsset(id, { name: upload.name, type: upload.type, bytes }, auth.actor));
    }

    await recordPlatformAudit({
      platformId: id,
      entityType: 'DATABASE',
      entityId: id,
      action: 'UPLOAD_ASSET',
      performedBy: auth.actor,
      changesSummary: `อัปโหลดไฟล์ ${assets.length} รายการเข้า Tenant Database`,
      snapshotAfter: { files: assets.map((asset) => asset.fileName) },
    });

    return NextResponse.json({ assets }, { status: 201 });
  } catch (error) {
    if (error instanceof AssetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Unable to upload tenant asset', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปโหลดไฟล์ได้' }, { status: 500 });
  }
}
