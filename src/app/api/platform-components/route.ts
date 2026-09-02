import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireApiSession, requirePlatformAccess } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PrivateRow = {
  id: string; platform_id: string; owner_user_id: string; component_key: string;
  component_name: string; component_type: string; definition: Record<string, unknown>;
  version: number; updated_at: Date; is_public?: boolean;
};

type SharedRow = {
  id: string; platform_id: string; source_component_id: string | null; shared_by_user_id: string;
  component_key: string; component_name: string; component_type: string;
  definition: Record<string, unknown>; source_version: number; created_at: Date;
  publisher_name?: string;
};

const privateDto = (row: PrivateRow) => ({
  id: row.id, platformId: row.platform_id, ownerUserId: row.owner_user_id,
  key: row.component_key, name: row.component_name, componentType: row.component_type,
  definition: row.definition, version: row.version, isPublic: Boolean(row.is_public),
  templateRef: `component://private/${row.id}`, updatedAt: row.updated_at.toISOString(),
});

const sharedDto = (row: SharedRow) => ({
  id: row.id, platformId: row.platform_id, sourceComponentId: row.source_component_id,
  sharedByUserId: row.shared_by_user_id, publisherName: row.publisher_name,
  key: row.component_key, name: row.component_name,
  componentType: row.component_type, definition: row.definition, sourceVersion: row.source_version,
  templateRef: `component://shared/${row.id}`, createdAt: row.created_at.toISOString(),
});

const stringField = (value: unknown, max: number) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : '';
const definitionField = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const searchParams = new URL(request.url).searchParams;
  const componentId = searchParams.get('componentId') || '';
  if (componentId) {
    try {
      const result = await getCoreDb().query<PrivateRow>(
        `SELECT pc.*, EXISTS (SELECT 1 FROM public.share_components s WHERE s.source_component_id=pc.id AND s.source_version=pc.version) AS is_public
         FROM public.platform_components
         pc WHERE pc.id=$1 AND pc.owner_user_id=$2`,
        [componentId, auth.sub],
      );
      if (!result.rowCount) return NextResponse.json({ error: 'Component not found' }, { status: 404 });
      const denied = await requirePlatformAccess(auth, result.rows[0].platform_id);
      if (denied) return denied;
      return NextResponse.json({ component: privateDto(result.rows[0]) });
    } catch (error) {
      console.error('Unable to resolve platform component', error);
      return NextResponse.json({ error: 'Unable to load component' }, { status: 500 });
    }
  }

  const platformId = searchParams.get('platformId') || '';
  if (!platformId) return NextResponse.json({ error: 'platformId is required' }, { status: 400 });
  const denied = await requirePlatformAccess(auth, platformId);
  if (denied) return denied;

  try {
    const [mine, shared] = await Promise.all([
      getCoreDb().query<PrivateRow>(
        `SELECT pc.*, EXISTS (SELECT 1 FROM public.share_components s WHERE s.source_component_id=pc.id AND s.source_version=pc.version) AS is_public
         FROM public.platform_components pc
         WHERE pc.platform_id=$1 AND pc.owner_user_id=$2 ORDER BY pc.updated_at DESC`,
        [platformId, auth.sub],
      ),
      getCoreDb().query<SharedRow>(
        `SELECT s.*, COALESCE(u.full_name, u.username, u.email) AS publisher_name
         FROM public.share_components s JOIN public.platform_users u ON u.id=s.shared_by_user_id
         WHERE s.platform_id=$1 AND s.shared_by_user_id<>$2 ORDER BY s.created_at DESC`,
        [platformId, auth.sub],
      ),
    ]);
    return NextResponse.json({ components: mine.rows.map(privateDto), sharedComponents: shared.rows.map(sharedDto) });
  } catch (error) {
    console.error('Unable to load platform components', error);
    return NextResponse.json({ error: 'Unable to load components; verify migration 021 has run' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const platformId = stringField(body.platformId, 64);
  if (!platformId) return NextResponse.json({ error: 'platformId is required' }, { status: 400 });
  const denied = await requirePlatformAccess(auth, platformId, 'STAFF');
  if (denied) return denied;

  try {
    if (body.action === 'share-copy' || body.action === 'publish') {
      const componentId = stringField(body.componentId, 64);
      if (!componentId) return NextResponse.json({ error: 'componentId is required' }, { status: 400 });
      const result = await getCoreDb().query<SharedRow>(
        `INSERT INTO public.share_components
           (platform_id, source_component_id, shared_by_user_id, component_key,
            component_name, component_type, definition, source_version)
         SELECT platform_id, id, owner_user_id, component_key, component_name,
                component_type, definition, version
         FROM public.platform_components
         WHERE id=$1 AND platform_id=$2 AND owner_user_id=$3
         ON CONFLICT (source_component_id, source_version) DO NOTHING
         RETURNING id, platform_id, source_component_id, shared_by_user_id, component_key,
                   component_name, component_type, definition, source_version, created_at`,
        [componentId, platformId, auth.sub],
      );
      if (!result.rowCount) return NextResponse.json({ error: 'Component not found, not owned by you, or this version is already shared' }, { status: 409 });
      return NextResponse.json({ sharedComponent: sharedDto(result.rows[0]) }, { status: 201 });
    }

    if (body.action === 'clone-shared') {
      const sharedComponentId = stringField(body.sharedComponentId, 64);
      if (!sharedComponentId) return NextResponse.json({ error: 'sharedComponentId is required' }, { status: 400 });
      const result = await getCoreDb().query<PrivateRow>(
        `INSERT INTO public.platform_components
           (platform_id, owner_user_id, component_key, component_name, component_type, definition)
         SELECT platform_id, $3,
                LEFT(component_key, 140) || '-copy-' || SUBSTRING(gen_random_uuid()::text, 1, 8),
                component_name || ' (Clone)', component_type, definition
         FROM public.share_components
         WHERE id=$1 AND platform_id=$2 AND shared_by_user_id<>$3
         RETURNING *, FALSE AS is_public`,
        [sharedComponentId, platformId, auth.sub],
      );
      if (!result.rowCount) return NextResponse.json({ error: 'Public component not found' }, { status: 404 });
      return NextResponse.json({ component: privateDto(result.rows[0]) }, { status: 201 });
    }

    const key = stringField(body.key, 160);
    const name = stringField(body.name, 255);
    const componentType = stringField(body.componentType, 120);
    const definition = definitionField(body.definition);
    if (!key || !name || !componentType || !definition) return NextResponse.json({ error: 'key, name, componentType and object definition are required' }, { status: 400 });
    const result = await getCoreDb().query<PrivateRow>(
      `INSERT INTO public.platform_components
         (platform_id, owner_user_id, component_key, component_name, component_type, definition)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING id, platform_id, owner_user_id, component_key, component_name,
                 component_type, definition, version, updated_at`,
      [platformId, auth.sub, key, name, componentType, JSON.stringify(definition)],
    );
    return NextResponse.json({ component: privateDto(result.rows[0]) }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') return NextResponse.json({ error: 'A component with this key already exists for this user' }, { status: 409 });
    console.error('Unable to create platform component', error);
    return NextResponse.json({ error: 'Unable to create component' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const platformId = stringField(body.platformId, 64);
  const componentId = stringField(body.componentId, 64);
  const name = stringField(body.name, 255);
  const componentType = stringField(body.componentType, 120);
  const definition = definitionField(body.definition);
  if (!platformId || !componentId || !name || !componentType || !definition) return NextResponse.json({ error: 'Invalid component update' }, { status: 400 });
  const denied = await requirePlatformAccess(auth, platformId, 'STAFF');
  if (denied) return denied;

  const result = await getCoreDb().query<PrivateRow>(
    `UPDATE public.platform_components
     SET component_name=$4, component_type=$5, definition=$6::jsonb, version=version+1
     WHERE id=$1 AND platform_id=$2 AND owner_user_id=$3
     RETURNING id, platform_id, owner_user_id, component_key, component_name,
               component_type, definition, version, updated_at`,
    [componentId, platformId, auth.sub, name, componentType, JSON.stringify(definition)],
  );
  if (!result.rowCount) return NextResponse.json({ error: 'Only the owner can update this component' }, { status: 403 });
  return NextResponse.json({ component: privateDto(result.rows[0]) });
}
