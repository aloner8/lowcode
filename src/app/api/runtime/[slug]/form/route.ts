import { NextResponse } from "next/server";
import { getCoreDb } from "@/lib/db/coreDb";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { validateTemplateDefinition } from "@/lib/template/validateTemplateDefinition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RuntimeDefinitionRow {
  app_slug: string;
  revision_digest: string;
  schema_version: string;
  compiled_definition: TemplateDefinition;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const result = await getCoreDb().query<RuntimeDefinitionRow>(
    `SELECT app.app_slug, revision.revision_digest, revision.schema_version,
            revision.compiled_definition
     FROM public.apps app
     JOIN public.templates template ON template.id = app.template_id
     JOIN public.customers customer ON customer.id = template.customer_id
     JOIN public.template_revisions revision
       ON revision.id = app.template_revision_id
      AND revision.template_id = app.template_id
     WHERE app.app_slug = $1
       AND app.is_active = TRUE
       AND app.is_suspended = FALSE
       AND app.observed_state IN ('STOPPED', 'STARTING', 'RUNNING')
       AND template.archived_at IS NULL
       AND customer.status = 'ACTIVE'
     LIMIT 1`,
    [slug],
  );
  if (!result.rowCount) {
    return NextResponse.json({ error: "App definition not found" }, { status: 404 });
  }

  const row = result.rows[0];
  const validation = validateTemplateDefinition(row.compiled_definition);
  if (!validation.valid) {
    console.error("Published App definition is invalid", {
      slug,
      revision: row.revision_digest,
      issues: validation.issues,
    });
    return NextResponse.json({ error: "App definition is unavailable" }, { status: 503 });
  }

  const routeId = new URL(request.url).searchParams.get("routeId");
  if (routeId && !row.compiled_definition.routes.some((route) => route.id === routeId)) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const definition = structuredClone(row.compiled_definition);
  // Server-owned connection selection never crosses the api/form boundary.
  delete definition.startup.connectionProfileRef;

  return NextResponse.json({
    app: { slug: row.app_slug },
    revision: {
      digest: row.revision_digest,
      schemaVersion: row.schema_version,
    },
    requestedRouteId: routeId,
    definition,
  });
}
