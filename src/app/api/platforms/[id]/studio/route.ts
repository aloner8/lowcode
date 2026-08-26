import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { AppRoute, ComponentNode, StudioServiceDefinition, ThemeConfig, createDefaultJwtAuthService } from '@/types';
import { createAdminPageTemplate } from '@/lib/studio/adminMenuTemplate';
import { ALL_BACKEND_COLLECTION_SEEDS, ALL_BACKEND_FORM_SEEDS, StudioCollectionDefinition, StudioFormDefinition } from '@/lib/studio/backendFormDefinitions';
import { BACKEND_DEFINITION_ISSUES } from '@/lib/studio/backendDefinitionValidation';
import { AUTH_COLLECTIONS, AUTH_LOGIN_FLOW, createAuthLoginPage, createAuthRoute, markAuthBundleReady } from '@/lib/studio/authServiceBundle';

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
  studio_routes: unknown[];
  studio_services: StudioServiceDefinition[];
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
    studioRoutes: row.studio_routes,
    studioServices: Array.isArray(row.studio_services) && row.studio_services.length ? row.studio_services : [createDefaultJwtAuthService(row.platform_slug)],
    studioInitialized: row.studio_initialized,
    isPublished: row.is_published,
    updatedAt: row.updated_at.toISOString(),
  };
}

const selectStudioPlatform = `
  SELECT p.id, p.platform_slug, p.platform_name, p.description,
         c.category_name, p.master_theme_config, p.studio_layout,
         p.studio_pages, p.studio_forms, p.studio_collections, p.studio_routes, p.studio_services, p.studio_initialized,
         p.is_published, p.updated_at
  FROM public.platforms p
  LEFT JOIN public.platform_categories c ON c.id = p.category_id
  WHERE p.id = $1
`;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await getCoreDb().query<StudioPlatformRow>(selectStudioPlatform, [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'ไม่พบ Platform ที่เลือก' }, { status: 404 });
    return NextResponse.json({ platform: toStudioPlatform(result.rows[0]) });
  } catch (error) {
    console.error('Unable to load platform studio data', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูล Platform ได้' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'STAFF');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as { studioLayout?: unknown; studioPages?: unknown; studioForms?: unknown; studioCollections?: unknown; studioServices?: unknown };
    if (!Array.isArray(body.studioLayout)) {
      return NextResponse.json({ error: 'ข้อมูล Layout ไม่ถูกต้อง' }, { status: 400 });
    }

    if (body.studioPages !== undefined && !Array.isArray(body.studioPages)) {
      return NextResponse.json({ error: 'ข้อมูล Pages ไม่ถูกต้อง' }, { status: 400 });
    }
    if (body.studioForms !== undefined && !Array.isArray(body.studioForms)) return NextResponse.json({ error: 'Studio Forms must be an array' }, { status: 400 });
    if (body.studioCollections !== undefined && !Array.isArray(body.studioCollections)) return NextResponse.json({ error: 'Studio Collections must be an array' }, { status: 400 });
    if (body.studioServices !== undefined && !Array.isArray(body.studioServices)) return NextResponse.json({ error: 'Studio Services must be an array' }, { status: 400 });

    const update = await getCoreDb().query(
      `UPDATE public.platforms
       SET studio_layout = $2::jsonb,
           studio_pages = COALESCE($3::jsonb, studio_pages),
           studio_forms = COALESCE($4::jsonb, studio_forms),
           studio_collections = COALESCE($5::jsonb, studio_collections),
           studio_services = COALESCE($6::jsonb, studio_services),
           studio_initialized = TRUE,
           content_updated_at = NOW(),
           runtime_status = CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END
       WHERE id = $1 RETURNING id`,
      [id, JSON.stringify(body.studioLayout), body.studioPages === undefined ? null : JSON.stringify(body.studioPages), body.studioForms === undefined ? null : JSON.stringify(body.studioForms), body.studioCollections === undefined ? null : JSON.stringify(body.studioCollections), body.studioServices === undefined ? null : JSON.stringify(body.studioServices)],
    );
    if (!update.rowCount) return NextResponse.json({ error: 'ไม่พบ Platform ที่เลือก' }, { status: 404 });

    const result = await getCoreDb().query<StudioPlatformRow>(selectStudioPlatform, [id]);
    await recordPlatformAudit({
      platformId: id,
      entityType: 'PAGE',
      entityId: id,
      action: 'UPDATE_PAGE',
      performedBy: auth.actor,
      changesSummary: `บันทึก Studio Layout (${(body.studioLayout as unknown[]).length} node)`,
    });
    return NextResponse.json({ platform: toStudioPlatform(result.rows[0]) });
  } catch (error) {
    console.error('Unable to save platform studio data', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Layout ลงฐานข้อมูลได้' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'STAFF');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as { action?: string; pageId?: string; moduleId?: string; preserveExisting?: boolean };
    if (!['provision-admin-sidebar', 'provision-cms-forms', 'provision-backend-module', 'provision-jwt-auth-bundle'].includes(body.action || '')) return NextResponse.json({ error: 'Unsupported Studio action' }, { status: 400 });

    const current = await getCoreDb().query<StudioPlatformRow>(selectStudioPlatform, [id]);
    if (!current.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    const platform = current.rows[0];
    if (body.action === 'provision-jwt-auth-bundle') {
      const containerName = `${platform.platform_slug}-frontend`;
      const pages = Array.isArray(platform.studio_pages) ? platform.studio_pages : [];
      const collections = Array.isArray(platform.studio_collections) ? platform.studio_collections : [];
      const routes = Array.isArray(platform.studio_routes) ? platform.studio_routes as AppRoute[] : [];
      const services = Array.isArray(platform.studio_services) && platform.studio_services.length ? platform.studio_services : [createDefaultJwtAuthService(platform.platform_slug)];
      const loginPage = createAuthLoginPage(containerName);
      const existingAdminPage = pages.find((page) => page.id === 'admin') || pages.find((page) => page.id === 'dashboard') || pages.find((page) => /admin|dashboard/i.test(`${page.id} ${page.name} ${page.title}`));
      const adminBase = existingAdminPage || { id: 'auth.admin', name: 'Admin (auth.admin.page)', title: 'Admin', containerName: `${platform.platform_slug}-backend`, routePath: '/admin', templateType: 'auth-admin', siteMapMaterialized: true, componentTree: [{ id: 'auth.admin.content', type: 'DynamicHtmlComponent', label: 'Protected Admin Content', props: { content: '<section class="p-4"><h1>Admin</h1><p>JWT protected administration area.</p></section>', authorization: { serviceId: 'service.auth.jwt', required: true } } }] };
      const adminTree = Array.isArray((adminBase as { componentTree?: ComponentNode[] }).componentTree) ? (adminBase as { componentTree: ComponentNode[] }).componentTree : [];
      const logoutButton: ComponentNode = { id: 'auth.logout.button', type: 'DynamicHtmlComponent', label: 'Logout Button', props: { componentRole: 'LinkButton', content: '<button type="button" class="btn btn-outline-danger" data-auth-action="logout">Logout</button>', action: { type: 'logout', serviceId: 'service.auth.jwt', clear: ['accessToken', 'refreshToken'], navigateToPageProperty: 'loginPageId' } } };
      const adminPage = { ...adminBase, componentTree: [...adminTree.filter((node) => node.id !== logoutButton.id), logoutButton] };
      const nextPages = [...pages.filter((page) => page.id !== loginPage.id && page.id !== adminPage.id), adminPage, loginPage];
      const authIds = new Set(AUTH_COLLECTIONS.map((collection) => collection.id));
      const nextCollections = [...collections.filter((collection) => !authIds.has(collection.id)), ...AUTH_COLLECTIONS];
      const authRoute = createAuthRoute(id, containerName);
      const nextRoutes = [...routes.filter((route) => route.id !== authRoute.id && !(route.containerName === containerName && route.path === '/login')), authRoute];
      const authService = services.find((service) => service.id === 'service.auth.jwt') || createDefaultJwtAuthService(platform.platform_slug);
      const nextServices = [...services.filter((service) => service.id !== authService.id), markAuthBundleReady(authService, adminPage.id)];
      const flowNodes = AUTH_LOGIN_FLOW.nodes.map((node) => node.id === 'login.success' ? { ...node, data: { ...node.data, targetPageId: adminPage.id } } : node);
      await getCoreDb().query(`UPDATE public.platforms SET studio_pages=$2::jsonb, studio_collections=$3::jsonb, studio_routes=$4::jsonb, studio_services=$5::jsonb, studio_initialized=TRUE, content_updated_at=NOW(), runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END WHERE id=$1`, [id, JSON.stringify(nextPages), JSON.stringify(nextCollections), JSON.stringify(nextRoutes), JSON.stringify(nextServices)]);
      await getCoreDb().query(`INSERT INTO public.platform_page_flows (platform_id, route_path, route_label, template_type, nodes, edges) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb) ON CONFLICT (platform_id, route_path) DO UPDATE SET route_label=EXCLUDED.route_label, template_type=EXCLUDED.template_type, nodes=EXCLUDED.nodes, edges=EXCLUDED.edges`, [id, AUTH_LOGIN_FLOW.routePath, AUTH_LOGIN_FLOW.routeLabel, AUTH_LOGIN_FLOW.templateType, JSON.stringify(flowNodes), JSON.stringify(AUTH_LOGIN_FLOW.edges)]);
      await getCoreDb().query(`INSERT INTO public.platform_page_flows (platform_id, route_path, route_label, template_type, nodes, edges) VALUES ($1,'/logout','JWT Logout','public_page',$2::jsonb,$3::jsonb) ON CONFLICT (platform_id, route_path) DO UPDATE SET nodes=EXCLUDED.nodes, edges=EXCLUDED.edges`, [id, JSON.stringify([{ id: 'logout.click', type: 'trigger', data: { label: 'Click Logout', nodeType: 'trigger', actionType: 'click', componentId: 'auth.logout.button' } }, { id: 'logout.clear', type: 'action', data: { label: 'Clear JWT', nodeType: 'action', actionType: 'service', serviceId: 'service.auth.jwt' } }, { id: 'logout.login', type: 'action', data: { label: 'Open Login Page', nodeType: 'action', actionType: 'navigate', targetPageId: loginPage.id } }]), JSON.stringify([{ id: 'logout.e1', source: 'logout.click', target: 'logout.clear' }, { id: 'logout.e2', source: 'logout.clear', target: 'logout.login' }])]);
      return NextResponse.json({ pages: nextPages, collections: nextCollections, routes: nextRoutes, services: nextServices, bundle: { serviceId: authService.id, loginPageId: loginPage.id, collectionIds: [...authIds], flowPath: AUTH_LOGIN_FLOW.routePath } });
    }
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
      await recordPlatformAudit({
        platformId: id,
        entityType: 'PLATFORM',
        entityId: id,
        action: 'PROVISION_MODULE',
        performedBy: auth.actor,
        changesSummary: `Provision module '${requestedModule || 'all'}' (${formsToAdd.length} forms, ${collectionsToAdd.length} collections)`,
      });
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
    await recordPlatformAudit({
      platformId: id,
      entityType: 'PAGE',
      entityId: id,
      action: 'PROVISION_MODULE',
      performedBy: auth.actor,
      changesSummary: `Provision admin sidebar สำหรับหน้า '${pageId}'`,
    });
    return NextResponse.json({ page: adminPage, menuItemCount: componentTree[0]?.props?.items?.length || 0 });
  } catch (error) {
    console.error('Unable to provision admin sidebar', error);
    return NextResponse.json({ error: 'Unable to provision admin sidebar' }, { status: 500 });
  }
}
