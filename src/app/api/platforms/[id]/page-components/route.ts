import { NextResponse } from "next/server";
import { getCoreDb } from "@/lib/db/coreDb";
import { requirePlatformSession } from "@/lib/auth/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

interface InstanceRow {
  id: string;
  platform_page_id: string;
  page_slug: string;
  platform_component_id: string;
  component_key: string;
  component_name: string;
  component_type: string;
  definition: Record<string, unknown>;
  version: number;
  instance_key: string;
  instance_name: string;
  layout_region: string;
  sort_order: number;
  props_overrides: Record<string, unknown>;
  request_bindings: Record<string, unknown>;
  response_bindings: Record<string, unknown>;
  updated_at: Date;
}

const dto = (row: InstanceRow) => ({
  id: row.id,
  pageId: row.platform_page_id,
  pageSlug: row.page_slug,
  componentId: row.platform_component_id,
  formId: row.component_key,
  componentName: row.component_name,
  componentType: row.component_type,
  definition: row.definition,
  componentVersion: row.version,
  instanceKey: row.instance_key,
  instanceName: row.instance_name,
  layoutRegion: row.layout_region,
  sortOrder: row.sort_order,
  propsOverrides: row.props_overrides,
  requestBindings: row.request_bindings,
  responseBindings: row.response_bindings,
  updatedAt: row.updated_at.toISOString(),
});

const selectInstances = `
  SELECT ppc.id, ppc.platform_page_id, pp.page_slug,
         ppc.platform_component_id, pc.component_key, pc.component_name,
         pc.component_type, pc.definition, pc.version,
         ppc.instance_key, ppc.instance_name, ppc.layout_region,
         ppc.sort_order, ppc.props_overrides, ppc.request_bindings,
         ppc.response_bindings, ppc.updated_at
  FROM public.platform_pages_components ppc
  JOIN public.platform_pages pp ON pp.id=ppc.platform_page_id
  JOIN public.platform_components pc ON pc.id=ppc.platform_component_id
  WHERE pp.platform_id=$1`;

const objectValue = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, "VIEWER");
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const values: unknown[] = [id];
  let query = selectInstances;
  if (params.get("pageId")) {
    values.push(params.get("pageId"));
    query += ` AND (pp.id::text=$${values.length} OR pp.page_slug=$${values.length})`;
  }
  if (params.get("componentId")) {
    values.push(params.get("componentId"));
    query += ` AND pc.id::text=$${values.length}`;
  }
  query += " ORDER BY pp.page_slug, ppc.sort_order, ppc.created_at";
  const result = await getCoreDb().query<InstanceRow>(query, values);
  return NextResponse.json({ instances: result.rows.map(dto) });
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, "STAFF");
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as Record<string, unknown>;
  if (body.action === "promote-embedded-forms") {
    const client = await getCoreDb().connect();
    try {
      await client.query("BEGIN");
      const promoted = await client.query<{ count: string }>(
        `WITH embedded AS (
           SELECT pp.id AS page_id, node, ordinality::integer AS sort_order
           FROM public.platform_pages pp
           CROSS JOIN LATERAL jsonb_array_elements(pp.component_tree)
             WITH ORDINALITY AS item(node, ordinality)
           WHERE pp.platform_id=$1 AND node->>'type'='FormComponent'
             AND COALESCE(node->>'id','') <> ''
         ), created AS (
           INSERT INTO public.platform_components
             (platform_id,owner_user_id,component_key,component_name,component_type,definition)
           SELECT DISTINCT ON (LOWER(BTRIM(node->>'id')))
             $1,$2,LEFT(node->>'id',160),
             LEFT(COALESCE(NULLIF(node->>'label',''),node->>'id'),255),
             'FormComponent',
             jsonb_build_object(
               'schemaVersion',1,'title',COALESCE(node->'props'->>'title',''),
               'description',COALESCE(node->'props'->>'description',''),
               'submitText',COALESCE(node->'props'->>'submitText','Submit'),
               'resetText',COALESCE(node->'props'->>'resetText',''),
               'mode',COALESCE(node->'props'->>'mode','insert'),
               'fields',COALESCE(node->'props'->'fields','[]'::jsonb),
               'collectionSet','[]'::jsonb,
               'requestContract',jsonb_build_array(
                 jsonb_build_object('id','currentUser','key','currentUser','label','Current user','source','auth.currentUser'),
                 jsonb_build_object('id','siteOwner','key','siteOwner','label','Site owner','source','app.owner')
               ),
               'responseContract',jsonb_build_array(
                 jsonb_build_object('id','formData','key','formData','label','Form data','type','object'),
                 jsonb_build_object('id','submitResult','key','submitResult','label','Submit result','type','object')
               )
             ) || COALESCE(node->'props','{}'::jsonb)
           FROM embedded
           ON CONFLICT DO NOTHING
           RETURNING id, component_key
         ), available AS (
           SELECT e.page_id,e.node,e.sort_order,pc.id AS component_id
           FROM embedded e
           JOIN public.platform_components pc
             ON pc.platform_id=$1 AND pc.owner_user_id=$2
            AND LOWER(BTRIM(pc.component_key))=LOWER(BTRIM(e.node->>'id'))
           UNION ALL
           SELECT e.page_id,e.node,e.sort_order,created.id AS component_id
           FROM embedded e
           JOIN created
             ON LOWER(BTRIM(created.component_key))=LOWER(BTRIM(e.node->>'id'))
         ), instances AS (
           INSERT INTO public.platform_pages_components
             (platform_page_id,platform_component_id,instance_key,instance_name,
              layout_region,sort_order,request_bindings,response_bindings)
           SELECT page_id,component_id,LEFT(node->>'id',180),
             LEFT(COALESCE(NULLIF(node->>'label',''),node->>'id'),255),
             LEFT(COALESCE(NULLIF(node->'props'->>'__layoutRegion',''),
                           NULLIF(node->'props'->>'__sectionId',''),'content'),80),
             sort_order,
             '{"currentUser":"auth.currentUser","siteOwner":"app.owner"}'::jsonb,
             '{"formData":"formData","submitResult":"submitResult"}'::jsonb
           FROM available
           ON CONFLICT (platform_page_id,instance_key) DO NOTHING
           RETURNING id
         )
         SELECT COUNT(*)::text AS count FROM available`,
        [id, auth.sub],
      );
      await client.query(
        `UPDATE public.platform_pages pp
         SET component_tree=COALESCE((
           SELECT jsonb_agg(item.node ORDER BY item.ordinality)
           FROM jsonb_array_elements(pp.component_tree)
             WITH ORDINALITY AS item(node, ordinality)
           WHERE NOT (
             item.node->>'type'='FormComponent'
             AND EXISTS (
               SELECT 1 FROM public.platform_pages_components ppc
               WHERE ppc.platform_page_id=pp.id
                 AND ppc.instance_key=item.node->>'id'
             )
           )
         ),'[]'::jsonb), version=version+1, updated_at=NOW()
         WHERE pp.platform_id=$1
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(pp.component_tree) node
             WHERE node->>'type'='FormComponent'
           )`,
        [id],
      );
      await client.query(
        `UPDATE public.platforms SET content_updated_at=NOW(),
           runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END
         WHERE id=$1`,
        [id],
      );
      await client.query("COMMIT");
      return NextResponse.json({
        promoted: Number(promoted.rows[0]?.count || 0),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Unable to promote embedded forms", error);
      return NextResponse.json(
        { error: "Unable to import embedded FormComponent nodes" },
        { status: 500 },
      );
    } finally {
      client.release();
    }
  }
  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  const componentId =
    typeof body.componentId === "string" ? body.componentId : "";
  if (!pageId || !componentId)
    return NextResponse.json(
      { error: "pageId and componentId are required" },
      { status: 400 },
    );

  const result = await getCoreDb().query<InstanceRow>(
    `WITH target AS (
       SELECT pp.id AS page_id, pp.page_slug, pc.id AS component_id,
              pc.component_key, pc.component_name,
              SUBSTRING(REPLACE(gen_random_uuid()::text,'-',''),1,8) AS suffix
       FROM public.platform_pages pp
       JOIN public.platform_components pc ON pc.platform_id=pp.platform_id
       WHERE pp.platform_id=$1 AND (pp.id::text=$2 OR pp.page_slug=$2)
         AND pc.id::text=$3 AND pc.component_type='FormComponent'
         AND pc.owner_user_id=$9
     ), inserted AS (
       INSERT INTO public.platform_pages_components
         (platform_page_id,platform_component_id,instance_key,instance_name,
          layout_region,sort_order,props_overrides,request_bindings,response_bindings)
       SELECT page_id,component_id,
              component_key || '_' || suffix,
              component_name || '_' || suffix,
              COALESCE(NULLIF($4,''),'content'),COALESCE($5,0),$6::jsonb,$7::jsonb,$8::jsonb
       FROM target RETURNING *
     )
     SELECT inserted.id, inserted.platform_page_id, pp.page_slug,
            inserted.platform_component_id, pc.component_key, pc.component_name,
            pc.component_type, pc.definition, pc.version,
            inserted.instance_key, inserted.instance_name, inserted.layout_region,
            inserted.sort_order, inserted.props_overrides, inserted.request_bindings,
            inserted.response_bindings, inserted.updated_at
     FROM inserted
     JOIN public.platform_pages pp ON pp.id=inserted.platform_page_id
     JOIN public.platform_components pc ON pc.id=inserted.platform_component_id`,
    [
      id,
      pageId,
      componentId,
      typeof body.layoutRegion === "string" ? body.layoutRegion : "content",
      Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      JSON.stringify(objectValue(body.propsOverrides)),
      JSON.stringify(objectValue(body.requestBindings)),
      JSON.stringify(objectValue(body.responseBindings)),
      auth.sub,
    ],
  );
  if (!result.rowCount)
    return NextResponse.json(
      { error: "Page or owned FormComponent was not found" },
      { status: 404 },
    );
  await getCoreDb().query(
    `UPDATE public.platforms SET content_updated_at=NOW(),
       runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END
     WHERE id=$1`,
    [id],
  );
  return NextResponse.json({ instance: dto(result.rows[0]) }, { status: 201 });
}
