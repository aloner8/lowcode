import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireApiSession, requirePlatformAccess } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReferenceRow = {
  id: string;
  component_key: string;
  component_name: string;
  component_type: string;
  definition: Record<string, unknown>;
  pages: Array<{ id: string; title: string; slug: string }> | null;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const collection = await getCoreDb().query<{ platform_id: string; collection_key: string }>(
    'SELECT platform_id, collection_key FROM public.collection_sets WHERE id=$1',
    [id],
  );
  if (!collection.rowCount) return NextResponse.json({ error: 'Collection Set not found' }, { status: 404 });
  const denied = await requirePlatformAccess(auth, collection.rows[0].platform_id, 'VIEWER');
  if (denied) return denied;

  const { platform_id: platformId, collection_key: key } = collection.rows[0];
  const result = await getCoreDb().query<ReferenceRow>(
    `SELECT pc.id, pc.component_key, pc.component_name, pc.component_type, pc.definition,
            COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', pp.id, 'title', pp.title, 'slug', pp.page_slug))
              FILTER (WHERE pp.id IS NOT NULL), '[]'::jsonb) AS pages
     FROM public.platform_components pc
     LEFT JOIN public.platform_pages_components ppc ON ppc.platform_component_id = pc.id
     LEFT JOIN public.platform_pages pp ON pp.id = ppc.platform_page_id
     WHERE pc.platform_id=$1
       AND pc.definition::text LIKE '%' || $2 || '%'
     GROUP BY pc.id, pc.component_key, pc.component_name, pc.component_type, pc.definition
     ORDER BY pc.component_name`,
    [platformId, key],
  );
  return NextResponse.json({
    references: result.rows.map((row) => ({
      id: row.id,
      key: row.component_key,
      name: row.component_name,
      componentType: row.component_type,
      definition: row.definition,
      pages: row.pages || [],
    })),
  });
}
