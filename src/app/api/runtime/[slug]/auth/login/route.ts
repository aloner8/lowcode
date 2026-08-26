import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getTenantDb } from '@/lib/db/tenantDb';
import { issueJwt } from '@/lib/services/jwtAuthService';
import type { StudioServiceDefinition } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
  if (!body.email || !body.password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });

  const platform = await getCoreDb().query<{ id: string; runtime_snapshot: any }>(
    'SELECT id, runtime_snapshot FROM public.platforms WHERE platform_slug=$1 AND runtime_snapshot IS NOT NULL', [slug],
  );
  if (!platform.rowCount) return NextResponse.json({ error: 'Published runtime not found' }, { status: 404 });
  const snapshot = platform.rows[0].runtime_snapshot;
  const service = (snapshot.services || []).find((item: StudioServiceDefinition) => item.id === 'service.auth.jwt') as StudioServiceDefinition | undefined;
  if (!service?.enabled) return NextResponse.json({ error: 'JWT Auth service is not enabled' }, { status: 409 });

  try {
    const { pool } = await getTenantDb(platform.rows[0].id);
    const userResult = await pool.query<{ id: string; email: string; display_name: string | null; role_name: string | null; permissions: string[] }>(
      `SELECT u.id::text, u.email, u.display_name, r.name AS role_name,
              COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
       FROM public.auth_users u LEFT JOIN public.auth_roles r ON r.id=u.role_id
       LEFT JOIN public.auth_role_permissions rp ON rp.role_id=r.id
       LEFT JOIN public.auth_permissions p ON p.id=rp.permission_id
       WHERE lower(u.email)=lower($1) AND u.is_active=true AND crypt($2,u.password_hash)=u.password_hash
       GROUP BY u.id,u.email,u.display_name,r.name LIMIT 1`,
      [body.email.trim(), body.password],
    );
    if (!userResult.rowCount) return NextResponse.json({ error: 'Email or password is incorrect' }, { status: 401 });
    const user = userResult.rows[0];
    const secretKey = service.config.secretEnvKey || 'PLATFORM_JWT_SECRET';
    const token = issueJwt({ sub: user.id, email: user.email, roles: user.role_name ? [user.role_name] : [], permissions: user.permissions }, service.config, process.env[secretKey] || '');
    const successFlow = (snapshot.flows || []).find((item: any) => item.routePath === (service.bundle?.flowPath || '/login'));
    const successNode = successFlow?.nodes?.find((item: any) => item.id === 'login.success' || item.data?.actionType === 'navigate');
    return NextResponse.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name, roles: user.role_name ? [user.role_name] : [], permissions: user.permissions }, successPageId: successNode?.data?.targetPageId || service.bundle?.adminPageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    if (/auth_users|does not exist/i.test(message)) return NextResponse.json({ error: 'Auth database has not been published yet' }, { status: 409 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
