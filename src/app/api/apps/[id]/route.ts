import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireApiSession, requirePlatformAccess } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { findSiteBySlug, listSites } from '@/lib/runtime/siteRegistry';
import type { ThemeConfig, ThemePreset } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THEME_PRESETS: ThemePreset[] = [
  'modern-indigo', 'corporate-emerald', 'dark-glassmorphism',
  'sunset-warm', 'cyberpunk', 'minimal-slate',
];

const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const LENGTH = /^\d*\.?\d+(?:rem|px|em)$/;

/** Rejects anything that could inject arbitrary CSS through the theme payload. */
function validateTheme(value: unknown): { theme?: ThemeConfig; error?: string } {
  if (!value || typeof value !== 'object') return { error: 'themeConfig ไม่ถูกต้อง' };
  const input = value as Record<string, unknown>;

  if (!THEME_PRESETS.includes(input.preset as ThemePreset)) {
    return { error: `preset ต้องเป็น ${THEME_PRESETS.join(' | ')}` };
  }
  if (input.mode !== 'light' && input.mode !== 'dark') {
    return { error: 'mode ต้องเป็น light หรือ dark' };
  }
  if (typeof input.primaryColor !== 'string' || !COLOR.test(input.primaryColor)) {
    return { error: 'primaryColor ต้องเป็นรหัสสี HEX' };
  }
  if (typeof input.borderRadius !== 'string' || !LENGTH.test(input.borderRadius)) {
    return { error: 'borderRadius ต้องเป็นหน่วย rem/px/em' };
  }
  if (typeof input.fontFamily !== 'string' || input.fontFamily.length > 200 || /[;{}<>]/.test(input.fontFamily)) {
    return { error: 'fontFamily ไม่ถูกต้อง' };
  }

  return {
    theme: {
      preset: input.preset as ThemePreset,
      mode: input.mode,
      primaryColor: input.primaryColor,
      borderRadius: input.borderRadius,
      fontFamily: input.fontFamily,
      ...(typeof input.secondaryColor === 'string' && COLOR.test(input.secondaryColor)
        ? { secondaryColor: input.secondaryColor }
        : {}),
    },
  };
}

async function loadApp(appId: string) {
  const result = await getCoreDb().query<{ platform_id: string | null; app_slug: string; app_name: string }>(
    'SELECT platform_id, app_slug, app_name FROM public.apps WHERE id = $1',
    [appId],
  );
  return result.rowCount ? result.rows[0] : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession('VIEWER');
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const app = await loadApp(id);
  if (!app) return NextResponse.json({ error: 'ไม่พบ Tenant App' }, { status: 404 });
  if (app.platform_id) {
    const denied = await requirePlatformAccess(auth, app.platform_id, 'APP_VIEWER');
    if (denied) return denied;
  }

  const site = await findSiteBySlug(app.app_slug);
  return NextResponse.json({ app: site });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession('DEVELOPER');
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const app = await loadApp(id);
  if (!app) return NextResponse.json({ error: 'ไม่พบ Tenant App' }, { status: 404 });
  if (app.platform_id) {
    const denied = await requirePlatformAccess(auth, app.platform_id, 'APP_OWNER');
    if (denied) return denied;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const updates: string[] = [];
    const params: unknown[] = [id];

    if (typeof body.appName === 'string' && body.appName.trim()) {
      params.push(body.appName.trim());
      updates.push(`app_name = $${params.length}`);
    }
    if (typeof body.description === 'string') {
      params.push(body.description.trim() || null);
      updates.push(`description = $${params.length}`);
    }
    if (typeof body.subdomain === 'string' && body.subdomain.trim()) {
      params.push(body.subdomain.trim().toLowerCase());
      updates.push(`subdomain = $${params.length}`);
    }
    if (typeof body.isActive === 'boolean') {
      params.push(body.isActive);
      updates.push(`is_active = $${params.length}`);
    }
    if (body.themeConfig !== undefined) {
      const { theme, error } = validateTheme(body.themeConfig);
      if (error) return NextResponse.json({ error }, { status: 400 });
      params.push(JSON.stringify(theme));
      updates.push(`theme_config = $${params.length}::jsonb`);
    }
    if (body.tenantOverrides && typeof body.tenantOverrides === 'object') {
      params.push(JSON.stringify(body.tenantOverrides));
      updates.push(`tenant_overrides = $${params.length}::jsonb`);
    }

    if (!updates.length) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });
    }

    await getCoreDb().query(`UPDATE public.apps SET ${updates.join(', ')} WHERE id = $1`, params);
    await recordPlatformAudit({
      platformId: app.platform_id,
      entityType: 'APP',
      entityId: id,
      action: 'UPDATE_APP',
      performedBy: auth.actor,
      changesSummary: `แก้ไข Tenant App "${app.app_name}"`,
      snapshotAfter: body as Record<string, unknown>,
    });

    const sites = await listSites(true);
    return NextResponse.json({ app: sites.find((site) => site.appId === id) });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Subdomain หรือ Port นี้ถูกใช้ไปแล้ว' }, { status: 409 });
    }
    console.error('Unable to update app', error);
    return NextResponse.json({ error: 'ไม่สามารถแก้ไข Tenant App ได้' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession('DEVELOPER');
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const app = await loadApp(id);
  if (!app) return NextResponse.json({ error: 'ไม่พบ Tenant App' }, { status: 404 });
  if (app.platform_id) {
    const denied = await requirePlatformAccess(auth, app.platform_id, 'APP_OWNER');
    if (denied) return denied;
  }

  await getCoreDb().query('DELETE FROM public.apps WHERE id = $1', [id]);
  await recordPlatformAudit({
    platformId: app.platform_id,
    entityType: 'APP',
    entityId: id,
    action: 'DELETE_APP',
    performedBy: auth.actor,
    changesSummary: `ลบ Tenant App "${app.app_name}" (${app.app_slug})`,
  });
  return NextResponse.json({ deleted: true });
}
