import 'server-only';

import { getCoreDb } from '@/lib/db/coreDb';
import { getTenantDb } from '@/lib/db/tenantDb';
import type { SitePage, SiteRuntime } from '@/lib/seo/siteSeo';
import type { ComponentNode } from '@/types';

/**
 * One article, read on the server.
 *
 * A listing without an article behind it is a dead end: the news cards on the
 * home page had nowhere to link, so published announcements could not actually
 * be read. This resolves `/{page}/{id}` against the same table the listing on
 * that page is bound to, and only if the platform has marked it publicly
 * readable — the same allow-list `resolveDataBindings` checks.
 */

export interface SitePost {
  id: string;
  title: string;
  body: string;
  image: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  categoryName: string | null;
  /** The listing page this article belongs under, for breadcrumbs and "back". */
  parent: SitePage;
}

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

/** The first data-bound table in a page's tree — what its listing shows. */
function boundTable(nodes: ComponentNode[]): string | null {
  for (const node of nodes) {
    const source = node.props?.dataSource as { table?: unknown } | undefined;
    if (source && typeof source.table === 'string' && IDENTIFIER.test(source.table)) {
      return source.table;
    }
    const nested = node.children ? boundTable(node.children) : null;
    if (nested) return nested;
  }
  return null;
}

async function isReadable(platformId: string, table: string): Promise<boolean> {
  const result = await getCoreDb().query<{ readable: string[] | null }>(
    `SELECT ARRAY(SELECT jsonb_array_elements_text(public_data_access -> 'readable')) AS readable
     FROM public.platforms WHERE id = $1`,
    [platformId],
  );
  return (result.rows[0]?.readable ?? []).includes(table);
}

const asIso = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' && value ? value : null;
};

/**
 * Resolves `segments` to an article, or null when they do not name one.
 *
 * Expects exactly `[pageId, id]` with a numeric id, so a two-segment path that
 * is really a nested page is left for `resolvePage` to answer.
 */
export async function resolvePost(
  runtime: SiteRuntime,
  segments: string[],
): Promise<SitePost | null> {
  const parts = segments.filter(Boolean);
  if (parts.length !== 2) return null;

  const [pageId, rawId] = parts;
  if (!/^\d{1,18}$/.test(rawId)) return null;

  const parent = runtime.pages.find((page) => page.id === pageId);
  if (!parent) return null;

  const table = boundTable(parent.componentTree);
  if (!table || !(await isReadable(runtime.platformId, table))) return null;

  try {
    const { pool } = await getTenantDb(runtime.platformId);

    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const names = new Set(columns.rows.map((row) => row.column_name));
    if (!names.has('id')) return null;

    // Unpublished rows must stay invisible even when the id is guessed.
    const published = names.has('status') ? 'AND status = 1' : '';
    const result = await pool.query<Record<string, unknown>>(
      `SELECT * FROM public.${quote(table)} WHERE id::text = $1 ${published} LIMIT 1`,
      [rawId],
    );
    if (!result.rowCount) return null;

    const row = result.rows[0];
    const title = String(row.name ?? row.title ?? '').trim();
    if (!title) return null;

    let categoryName: string | null = null;
    const categoryId = row.cms_category_id ?? row.category_id;
    if (categoryId != null && names.has('cms_category_id')) {
      const category = await pool
        .query<{ name: string }>('SELECT name FROM public.cms_category WHERE id = $1', [categoryId])
        .catch(() => null);
      categoryName = category?.rows[0]?.name ?? null;
    }

    return {
      id: String(row.id),
      title,
      body: String(row.description ?? row.body ?? ''),
      image: typeof row.image === 'string' && row.image ? row.image : null,
      publishedAt: asIso(row.publish_at) ?? asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
      categoryName,
      parent,
    };
  } catch (error) {
    console.error(`[site] unable to read article '${rawId}' from '${table}'`, error);
    return null;
  }
}
