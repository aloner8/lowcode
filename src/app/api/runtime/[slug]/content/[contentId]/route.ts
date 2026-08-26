import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import type { ComponentNode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ContentPlatformRow {
  studio_pages: Array<{ id: string; title?: string; componentTree?: ComponentNode[] }>;
  studio_forms: Array<{ id: string; name?: string; componentTree?: ComponentNode[] }>;
  studio_collections: Array<{ id: string; name?: string; components?: Array<{ id: string; label?: string; componentTree?: ComponentNode[] }> }>;
  content_updated_at: Date;
}

const findNode = (nodes: ComponentNode[], id: string): ComponentNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNode(node.children || [], id);
    if (nested) return nested;
  }
};

export async function GET(_request: Request, context: { params: Promise<{ slug: string; contentId: string }> }) {
  const { slug, contentId } = await context.params;
  const result = await getCoreDb().query<ContentPlatformRow>(
    `SELECT studio_pages, studio_forms, studio_collections, content_updated_at FROM public.platforms WHERE platform_slug=$1`,
    [slug],
  );
  if (!result.rowCount) return NextResponse.json({ error: 'Runtime application not found' }, { status: 404 });
  const platform = result.rows[0];
  const pages = Array.isArray(platform.studio_pages) ? platform.studio_pages : [];
  const forms = Array.isArray(platform.studio_forms) ? platform.studio_forms : [];
  const collections = Array.isArray(platform.studio_collections) ? platform.studio_collections : [];
  let kind = 'component'; let label = contentId; let componentTree: ComponentNode[] | undefined;
  const page = pages.find((item) => item.id === contentId);
  const form = forms.find((item) => item.id === contentId);
  const collection = collections.find((item) => item.id === contentId);
  const collectionComponent = collections.flatMap((item) => item.components || []).find((item) => item.id === contentId);
  if (page) { kind = 'page'; label = page.title || page.id; componentTree = page.componentTree; }
  else if (form) { kind = 'form'; label = form.name || form.id; componentTree = form.componentTree; }
  else if (collectionComponent) { kind = 'app-component'; label = collectionComponent.label || collectionComponent.id; componentTree = collectionComponent.componentTree; }
  else if (collection) { kind = 'collection'; label = collection.name || collection.id; componentTree = collection.components?.find((item) => item.componentTree?.length)?.componentTree; }
  else {
    const allTrees = [...pages.map((item) => item.componentTree || []), ...forms.map((item) => item.componentTree || []), ...collections.flatMap((item) => (item.components || []).map((component) => component.componentTree || []))];
    const node = allTrees.map((tree) => findNode(tree, contentId)).find(Boolean);
    if (node) componentTree = [node];
  }
  if (!componentTree?.length) return NextResponse.json({ error: `Content '${contentId}' not found` }, { status: 404 });
  const dynamicHtml = componentTree.length === 1 && componentTree[0].type === 'DynamicHtmlComponent' ? componentTree[0] : undefined;
  const version = createHash('sha1').update(JSON.stringify(componentTree)).digest('hex').slice(0, 12);
  return NextResponse.json({ id: contentId, kind, label, version, updatedAt: platform.content_updated_at.toISOString(), componentTree, html: dynamicHtml?.props?.content, data: dynamicHtml?.props?.data || {} }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
