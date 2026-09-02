import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireApiSession, requirePlatformAccess } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CollectionRow = {
  id: string; platform_id: string; owner_user_id: string; collection_key: string;
  collection_name: string; definition: Record<string, unknown>; version: number;
  updated_at: Date; is_public?: boolean;
};
type SharedRow = {
  id: string; platform_id: string; source_collection_id: string | null;
  shared_by_user_id: string; publisher_name: string; collection_key: string;
  collection_name: string; definition: Record<string, unknown>; source_version: number;
  created_at: Date;
};

const ownDto = (row: CollectionRow) => ({
  id: row.id, platformId: row.platform_id, ownerUserId: row.owner_user_id,
  key: row.collection_key, name: row.collection_name, definition: row.definition,
  version: row.version, isPublic: Boolean(row.is_public), updatedAt: row.updated_at.toISOString(),
});
const publicDto = (row: SharedRow) => ({
  id: row.id, platformId: row.platform_id, sourceCollectionId: row.source_collection_id,
  sharedByUserId: row.shared_by_user_id, publisherName: row.publisher_name,
  key: row.collection_key, name: row.collection_name, definition: row.definition,
  sourceVersion: row.source_version, createdAt: row.created_at.toISOString(),
});
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : '';
const object = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const collectionId = params.get('collectionId') || '';
  if (collectionId) {
    const result = await getCoreDb().query<CollectionRow>(
      `SELECT cs.*, EXISTS (SELECT 1 FROM public.shared_collection_sets s WHERE s.source_collection_id=cs.id AND s.source_version=cs.version) AS is_public
       FROM public.collection_sets cs WHERE cs.id=$1 AND cs.owner_user_id=$2`,
      [collectionId, auth.sub],
    );
    if (!result.rowCount) return NextResponse.json({ error: 'Collection Set not found' }, { status: 404 });
    const denied = await requirePlatformAccess(auth, result.rows[0].platform_id);
    if (denied) return denied;
    return NextResponse.json({ collection: ownDto(result.rows[0]) });
  }

  const platformId = params.get('platformId') || '';
  if (!platformId) return NextResponse.json({ error: 'platformId is required' }, { status: 400 });
  const denied = await requirePlatformAccess(auth, platformId);
  if (denied) return denied;
  const [mine, publicSets] = await Promise.all([
    getCoreDb().query<CollectionRow>(
      `SELECT cs.*, EXISTS (SELECT 1 FROM public.shared_collection_sets s WHERE s.source_collection_id=cs.id AND s.source_version=cs.version) AS is_public
       FROM public.collection_sets cs WHERE cs.platform_id=$1 AND cs.owner_user_id=$2 ORDER BY cs.updated_at DESC`,
      [platformId, auth.sub],
    ),
    getCoreDb().query<SharedRow>(
      `SELECT s.*, COALESCE(u.full_name, u.username, u.email) AS publisher_name
       FROM public.shared_collection_sets s JOIN public.platform_users u ON u.id=s.shared_by_user_id
       WHERE s.platform_id=$1 AND s.shared_by_user_id<>$2 ORDER BY s.created_at DESC`,
      [platformId, auth.sub],
    ),
  ]);
  return NextResponse.json({ collections: mine.rows.map(ownDto), publicCollections: publicSets.rows.map(publicDto) });
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const platformId = text(body.platformId, 64);
  if (!platformId) return NextResponse.json({ error: 'platformId is required' }, { status: 400 });
  const denied = await requirePlatformAccess(auth, platformId, 'STAFF');
  if (denied) return denied;

  if (body.action === 'publish') {
    const collectionId = text(body.collectionId, 64);
    const result = await getCoreDb().query<SharedRow>(
      `INSERT INTO public.shared_collection_sets
         (platform_id, source_collection_id, shared_by_user_id, collection_key, collection_name, definition, source_version)
       SELECT platform_id, id, owner_user_id, collection_key, collection_name, definition, version
       FROM public.collection_sets WHERE id=$1 AND platform_id=$2 AND owner_user_id=$3
       ON CONFLICT (source_collection_id, source_version) DO NOTHING
       RETURNING *, ''::text AS publisher_name`,
      [collectionId, platformId, auth.sub],
    );
    if (!result.rowCount) return NextResponse.json({ error: 'Collection Set is already public or was not found' }, { status: 409 });
    await recordPlatformAudit({ platformId, entityType: 'COLLECTION', entityId: collectionId, action: 'PUBLISH_COLLECTION', performedBy: auth.actor, changesSummary: `Publish Collection Set ${result.rows[0].collection_name} version ${result.rows[0].source_version}`, snapshotAfter: result.rows[0].definition });
    return NextResponse.json({ publicCollection: publicDto(result.rows[0]) }, { status: 201 });
  }

  if (body.action === 'clone') {
    const sharedCollectionId = text(body.sharedCollectionId, 64);
    const result = await getCoreDb().query<CollectionRow>(
      `INSERT INTO public.collection_sets
         (platform_id, owner_user_id, collection_key, collection_name, definition)
       SELECT platform_id, $3,
              LEFT(collection_key, 140) || '-copy-' || SUBSTRING(gen_random_uuid()::text, 1, 8),
              collection_name || ' (Clone)', definition
       FROM public.shared_collection_sets
       WHERE id=$1 AND platform_id=$2 AND shared_by_user_id<>$3
       RETURNING *, FALSE AS is_public`,
      [sharedCollectionId, platformId, auth.sub],
    );
    if (!result.rowCount) return NextResponse.json({ error: 'Public Collection Set not found' }, { status: 404 });
    await recordPlatformAudit({ platformId, entityType: 'COLLECTION', entityId: result.rows[0].id, action: 'CLONE_COLLECTION', performedBy: auth.actor, changesSummary: `Clone Collection Set ${result.rows[0].collection_name}`, snapshotAfter: result.rows[0].definition });
    return NextResponse.json({ collection: ownDto(result.rows[0]) }, { status: 201 });
  }

  const key = text(body.key, 160);
  const name = text(body.name, 255);
  const definition = object(body.definition);
  if (!key || !name || !definition) return NextResponse.json({ error: 'key, name and definition are required' }, { status: 400 });
  const result = await getCoreDb().query<CollectionRow>(
    `INSERT INTO public.collection_sets (platform_id, owner_user_id, collection_key, collection_name, definition)
     VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *, FALSE AS is_public`,
    [platformId, auth.sub, key, name, JSON.stringify(definition)],
  );
  await recordPlatformAudit({ platformId, entityType: 'COLLECTION', entityId: result.rows[0].id, action: 'CREATE_COLLECTION', performedBy: auth.actor, changesSummary: `Create Collection Set ${name}`, snapshotAfter: definition });
  return NextResponse.json({ collection: ownDto(result.rows[0]) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const platformId = text(body.platformId, 64);
  const collectionId = text(body.collectionId, 64);
  const name = text(body.name, 255);
  const definition = object(body.definition);
  if (!platformId || !collectionId || !name || !definition) return NextResponse.json({ error: 'Invalid Collection Set update' }, { status: 400 });
  const denied = await requirePlatformAccess(auth, platformId, 'STAFF');
  if (denied) return denied;
  const result = await getCoreDb().query<CollectionRow & { previous_definition: Record<string, unknown> }>(
    `WITH previous AS (
       SELECT definition FROM public.collection_sets WHERE id=$1 AND platform_id=$2 AND owner_user_id=$3
     ), updated AS (
       UPDATE public.collection_sets SET collection_name=$4, definition=$5::jsonb, version=version+1
       WHERE id=$1 AND platform_id=$2 AND owner_user_id=$3 RETURNING *
     ) SELECT updated.*, FALSE AS is_public, previous.definition AS previous_definition FROM updated CROSS JOIN previous`,
    [collectionId, platformId, auth.sub, name, JSON.stringify(definition)],
  );
  if (!result.rowCount) return NextResponse.json({ error: 'Only the owner can update this Collection Set' }, { status: 403 });
  await recordPlatformAudit({ platformId, entityType: 'COLLECTION', entityId: collectionId, action: 'UPDATE_COLLECTION', performedBy: auth.actor, changesSummary: `Update Collection Set ${name} to version ${result.rows[0].version}`, snapshotBefore: result.rows[0].previous_definition, snapshotAfter: definition });
  return NextResponse.json({ collection: ownDto(result.rows[0]) });
}
