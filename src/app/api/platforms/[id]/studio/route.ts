import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ComponentNode, ThemeConfig } from '@/types';
import { createAdminPageTemplate } from '@/lib/studio/adminMenuTemplate';
import { ALL_BACKEND_COLLECTION_SEEDS, ALL_BACKEND_FORM_SEEDS, StudioCollectionDefinition, StudioFormDefinition } from '@/lib/studio/backendFormDefinitions';
import { BACKEND_DEFINITION_ISSUES } from '@/lib/studio/backendDefinitionValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StudioPlatformRow {
  id: string;
  platform_slug: string;
  platform_name: string;
  description: string | null;
  category_name: string | null;
  master_theme_config: ThemeConfig;
  studio_layout: ComponentNode[];
  studio_pages: Array<{ id: string; name: string; title: string }>;
  studio_forms: StudioFormDefinition[];
  studio_collections: StudioCollectionDefinition[];
  studio_initialized: boolean;
  is_published: boolean;
  updated_at: Date;
}

function toStudioPlatform(row: StudioPlatformRow) {
  return {
    id: row.id,
    platformSlug: row.platform_slug,
    platformName: row.platform_name,
    description: row.description ?? undefined,
    category: row.category_name ?? undefined,
    masterThemeConfig: row.master_theme_config,
    studioLayout: row.studio_layout,
    studioPages: row.studio_pages,
    studioForms: row.studio_forms,
    studioCollections: row.studio_collections,
    studioInitialized: row.studio_initialized,
    isPublished: row.is_published,
    updatedAt: row.updated_at.toISOString(),
  };
}

const selectStudioPlatform = `
  SELECT p.id, p.platform_slug, p.platform_name, p.description,
         c.category_name, p.master_theme_config, p.studio_layout,
         p.studio_pages, p.studio_forms, p.studio_collections, p.studio_initialized,
         p.is_published, p.updated_at
  FROM public.platforms p
  LEFT JOIN public.platform_categories c ON c.id = p.category_id
  WHERE p.id = $1
`;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await getCoreDb().query<StudioPlatformRow>(selectStudioPlatform, [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'ไม่พบ Platform ที่เลือก' }, { status: 404 });
    return NextResponse.json({ platform: toStudioPlatform(result.rows[0]) });
  } catch (error) {
    console.error('Unable to load platform studio data', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูล Platform ได้' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { studioLayout?: unknown; studioPages?: unknown; studioForms?: unknown; studioCollections?: unknown };
    if (!Array.isArray(body.studioLayout)) {
      return NextResponse.json({ error: 'ข้อมูล Layout ไม่ถูกต้อง' }, { status: 400 });
    }

    if (body.studioPages !== undefined && !Array.isArray(body.studioPages)) {
      return NextResponse.json({ error: 'ข้อมูล Pages ไม่ถูกต้อง' }, { status: 400 });
    }
    if (body.studioForms !== undefined && !Array.isArray(body.studioForms)) return NextResponse.json({ error: 'Studio Forms must be an array' }, { status: 400 });
    if (body.studioCollections !== undefined && !Array.isArray(body.studioCollections)) return NextResponse.json({ error: 'Studio Collections must be an array' }, { status: 400 });

    const update = await getCoreDb().query(
      `UPDATE public.platforms
       SET studio_layout = $2::jsonb,
           studio_pages = COALESCE($3::jsonb, studio_pages),
           studio_forms = COALESCE($4::jsonb, studio_forms),
           studio_collections = COALESCE($5::jsonb, studio_collections),
           studio_initialized = TRUE,
           content_updated_at = NOW(),
           runtime_status = CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END
       WHERE id = $1 RETURNING id`,
      [id, JSON.stringify(body.studioLayout), body.studioPages === undefined ? null : JSON.stringify(body.studioPages), body.studioForms === undefined ? null : JSON.stringify(body.studioForms), body.studioCollections === undefined ? null : JSON.stringify(body.studioCollections)],
    );
    if (!update.rowCount) return NextResponse.json({ error: 'ไม่พบ Platform ที่เลือก' }, { status: 404 });

    const result = await getCoreDb().query<StudioPlatformRow>(selectStudioPlatform, [id]);
    return NextResponse.json({ platform: toStudioPlatform(result.rows[0]) });
  } catch (error) {
    console.error('Unable to save platform studio data', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Layout ลงฐานข้อมูลได้' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { action?: string; pageId?: string; moduleId?: string; preserveExisting?: boolean };
    if (!['provision-admin-sidebar', 'provision-cms-forms', 'provision-backend-module'].includes(body.action || '')) return NextResponse.json({ error: 'Unsupported Studio action' }, { status: 400 });

    const current = await getCoreDb().query<StudioPlatformRow>(selectStudioPlatform, [id]);
    if (!current.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    const platform = current.rows[0];
    if (BACKEND_DEFINITION_ISSUES.length) {
      return NextResponse.json({ error: 'Backend definitions are inconsistent', issues: BACKEND_DEFINITION_ISSUES }, { status: 500 });
    }
    if (body.action === 'provision-cms-forms' || body.action === 'provision-backend-module') {
      const currentForms = Array.isArray(platform.studio_forms) ? platform.studio_forms : [];
      const currentCollections = Array.isArray(platform.studio_collections) ? platform.studio_collections : [];
      const requestedModule = body.action === 'provision-backend-module' ? body.moduleId : undefined;
      const validModules = new Set(ALL_BACKEND_COLLECTION_SEEDS.map((item) => item.moduleId));
      if (requestedModule && !validModules.has(requestedModule)) return NextResponse.json({ error: `Unknown backend module '${requestedModule}'` }, { status: 400 });
      if (body.action === 'provision-backend-module' && !requestedModule) return NextResponse.json({ error: 'moduleId is required' }, { status: 400 });
      const seedForms = requestedModule ? ALL_BACKEND_FORM_SEEDS.filter((item) => item.moduleId === requestedModule) : ALL_BACKEND_FORM_SEEDS;
      const seedCollections = requestedModule ? ALL_BACKEND_COLLECTION_SEEDS.filter((item) => item.moduleId === requestedModule) : ALL_BACKEND_COLLECTION_SEEDS;
      const formIds = new Set(seedForms.map((item) => item.id));
      const collectionIds = new Set(seedCollections.map((item) => item.id));
      const existingFormIds = new Set(currentForms.map((item) => item.id));
      const existingCollectionIds = new Set(currentCollections.map((item) => item.id));
      const formsToAdd = body.preserveExisting ? seedForms.filter((item) => !existingFormIds.has(item.id)) : seedForms;
      const collectionsToAdd = body.preserveExisting ? seedCollections.filter((item) => !existingCollectionIds.has(item.id)) : seedCollections;
      const studioForms = body.preserveExisting ? [...currentForms, ...formsToAdd] : [...currentForms.filter((item) => !formIds.has(item.id)), ...formsToAdd];
      const studioCollections = body.preserveExisting ? [...currentCollections, ...collectionsToAdd] : [...currentCollections.filter((item) => !collectionIds.has(item.id)), ...collectionsToAdd];
      await getCoreDb().query(`UPDATE public.platforms SET studio_forms=$2::jsonb, studio_collections=$3::jsonb, content_updated_at=NOW(), runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END WHERE id=$1`, [id, JSON.stringify(studioForms), JSON.stringify(studioCollections)]);
      return NextResponse.json({ forms: studioForms, collections: studioCollections, provisioned: { moduleId: requestedModule || 'all', forms: formsToAdd.length, collections: collectionsToAdd.length, preserveExisting: Boolean(body.preserveExisting) } });
    }
    const pageId = body.pageId || 'admin';
    const componentTree = createAdminPageTemplate(platform.platform_name);
    const existingPages = Array.isArray(platform.studio_pages) ? platform.studio_pages : [];
    const existingPage = existingPages.find((page) => page.id === pageId) as (StudioPlatformRow['studio_pages'][number] & { componentTree?: ComponentNode[]; templateType?: string; layoutHistory?: unknown[]; isDefaultPage?: boolean }) | undefined;
    const previousHistory = existingPage?.componentTree?.length ? [...(existingPage.layoutHistory || []), { templateType: existingPage.templateType || 'custom', componentTree: existingPage.componentTree, savedAt: new Date().toISOString() }].slice(-10) : existingPage?.layoutHistory || [];
    const adminPage = { ...existingPage, id: pageId, name: existingPage?.name || `Backend Administration (${pageId}.page)`, title: existingPage?.title || 'ระบบจัดการหลังบ้าน', templateType: 'admin_backend', componentTree, layoutHistory: previousHistory, isDefaultPage: existingPage?.isDefaultPage || false };
    const studioPages = existingPage ? existingPages.map((page) => page.id === pageId ? adminPage : page) : [...existingPages, adminPage];

    await getCoreDb().query(
      `UPDATE public.platforms SET studio_layout = $2::jsonb, studio_pages = $3::jsonb,
       studio_initialized = TRUE, content_updated_at = NOW(),
       runtime_status = CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END
       WHERE id = $1`,
      [id, JSON.stringify(componentTree), JSON.stringify(studioPages)],
    );
    return NextResponse.json({ page: adminPage, menuItemCount: componentTree[0]?.props?.items?.length || 0 });
  } catch (error) {
    console.error('Unable to provision admin sidebar', error);
    return NextResponse.json({ error: 'Unable to provision admin sidebar' }, { status: 500 });
  }
}
