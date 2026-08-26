import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const result = await getCoreDb().query<{ runtime_snapshot: any }>(
    `SELECT runtime_snapshot FROM public.platforms WHERE platform_slug=$1 AND runtime_snapshot IS NOT NULL`, [slug],
  );
  if (!result.rowCount) return NextResponse.json({ error: 'Published runtime snapshot not found' }, { status: 404 });
  const snapshot = result.rows[0].runtime_snapshot;
  const surface = process.env.APP_SURFACE || 'frontend';
  const routes = Array.isArray(snapshot.routes) ? snapshot.routes : [];
  const services = Array.isArray(snapshot.services) ? snapshot.services : [];
  const surfaceRoutes = routes.filter((item: any) => String(item.containerName || '').endsWith(`-${surface}`));
  const startRoute = surfaceRoutes.find((item: any) => item.isDefault || item.metadata?.isStartPoint)
    || routes.find((item: any) => (item.isDefault || item.metadata?.isStartPoint) && item.targetType === 'service');
  const startService = startRoute?.targetType === 'service' ? services.find((item: any) => item.id === startRoute.targetId) : undefined;
  const startPageId = startService?.bundle?.loginPageId
    || (startRoute?.targetType === 'page' ? startRoute.targetId : undefined);
  const page = snapshot.pages?.find((item: any) => item.id === startPageId)
    || snapshot.pages?.find((item: any) => item.id === (surface === 'backend' ? 'admin' : 'index'))
    || snapshot.pages?.find((item: any) => item.id === 'index') || snapshot.pages?.[0];
  return NextResponse.json({
    appConfig: {
      id: snapshot.platformId, appSlug: snapshot.platformSlug, appName: snapshot.platformName,
      port: Number(process.env.PORT || 33000), subdomain: `${snapshot.platformSlug}.localhost`,
      tenantDbName: `platform_${String(snapshot.platformSlug).replace(/-/g, '_')}`,
      themeConfig: snapshot.themeConfig, createdAt: snapshot.generatedAt, updatedAt: snapshot.generatedAt,
    },
    pageLayout: {
      id: `${snapshot.platformId}:index`, appId: snapshot.platformId, pageSlug: page?.id || 'index',
      title: page?.title || 'Home', isDefaultPage: true, componentTree: page?.componentTree || [],
      createdAt: snapshot.generatedAt, updatedAt: snapshot.generatedAt,
    },
    forms: snapshot.forms || [],
    collections: snapshot.collections || [],
    routes: snapshot.routes || [],
    pages: snapshot.pages || [],
    services,
    flows: snapshot.flows || [],
  });
}
