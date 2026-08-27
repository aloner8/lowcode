import 'server-only';

import { getCoreDb } from '@/lib/db/coreDb';
import { getTenantDb } from '@/lib/db/tenantDb';
import type { ComponentNode } from '@/types';

/**
 * Fills data-bound components with real rows on the server.
 *
 * Without this, a news list would arrive at the browser empty and be populated
 * by a client fetch — invisible to crawlers. Resolving here means the article
 * headings, dates and excerpts are part of the HTML response.
 *
 * Only tables the platform has explicitly marked publicly readable are queried,
 * so this cannot become a way to read arbitrary tenant data.
 */

export interface DataSourceBinding {
  table?: string;
  orderBy?: string;
  direction?: 'asc' | 'desc';
  limit?: number;
  where?: Record<string, string | number | boolean>;
  /** Column used as the display title, defaults to `name`. */
  titleField?: string;
  /**
   * Where each row links to, as a relative path with `{column}` placeholders —
   * `/news/{id}`. Without it a listing renders headings that lead nowhere, which
   * is what the news cards did before. Absolute URLs are rejected so a row can
   * never point the site's own listings at another host.
   */
  linkPattern?: string;
  /**
   * Splits the rows across pages. The listing then receives `page`, `pageCount`
   * and `total` alongside its rows, so it can render a pager. Without it a
   * listing shows only its first `limit` rows and the rest are unreachable.
   */
  paginate?: boolean;
}

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const MAX_ROWS = 50;

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

function readBinding(node: ComponentNode): DataSourceBinding | null {
  const source = node.props?.dataSource;
  if (!source || typeof source !== 'object') return null;
  const binding = source as DataSourceBinding;
  return typeof binding.table === 'string' && IDENTIFIER.test(binding.table) ? binding : null;
}

/** Collects every distinct table referenced by the tree. */
function collectBindings(nodes: ComponentNode[]): Map<string, DataSourceBinding[]> {
  const bindings = new Map<string, DataSourceBinding[]>();

  const visit = (node: ComponentNode) => {
    const binding = readBinding(node);
    if (binding?.table) {
      const existing = bindings.get(binding.table) ?? [];
      existing.push(binding);
      bindings.set(binding.table, existing);
    }
    node.children?.forEach(visit);
  };

  nodes.forEach(visit);
  return bindings;
}

async function readableTables(platformId: string): Promise<Set<string>> {
  const result = await getCoreDb().query<{ readable: string[] | null }>(
    `SELECT ARRAY(SELECT jsonb_array_elements_text(public_data_access -> 'readable')) AS readable
     FROM public.platforms WHERE id = $1`,
    [platformId],
  );
  return new Set(result.rows[0]?.readable ?? []);
}

interface PagedRows {
  rows: Record<string, unknown>[];
  total: number;
  /** The page actually served, which may differ from the one asked for. */
  page: number;
}

async function fetchRows(
  platformId: string,
  binding: DataSourceBinding,
  page = 1,
): Promise<PagedRows> {
  const { pool } = await getTenantDb(platformId);
  const table = binding.table as string;

  const columns = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  if (!columns.rowCount) return { rows: [], total: 0, page: 1 };
  const columnNames = new Set(columns.rows.map((row) => row.column_name));

  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(binding.where ?? {})) {
    if (!columnNames.has(key)) continue;
    params.push(value);
    conditions.push(`${quote(key)}::text = $${params.length}`);
  }
  // Published-content convention used across the CMS tables.
  if (!('status' in (binding.where ?? {})) && columnNames.has('status')) {
    conditions.push('status = 1');
  }

  const orderColumn =
    binding.orderBy && columnNames.has(binding.orderBy)
      ? binding.orderBy
      : ['publish_at', 'created_at', 'sort_order', 'id'].find((name) => columnNames.has(name)) ?? 'id';
  const direction = binding.direction === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(Math.max(binding.limit ?? 6, 1), MAX_ROWS);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Counting only when a pager will be shown keeps the extra query off every
  // listing on the home page.
  let total = 0;
  if (binding.paginate) {
    const counted = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM public.${quote(table)} ${where}`,
      params,
    );
    total = Number(counted.rows[0]?.total ?? 0);
  }

  // A page past the end shows the last page rather than an empty listing: the
  // number can come from a stale link or a hand-typed URL, and neither should
  // look like the archive is gone.
  const pageCount = binding.paginate ? Math.max(1, Math.ceil(total / limit)) : 1;
  const served = binding.paginate ? Math.min(Math.max(1, page), pageCount) : 1;

  params.push(limit, (served - 1) * limit);

  const result = await pool.query(
    `SELECT * FROM public.${quote(table)} ${where}
     ORDER BY ${quote(orderColumn)} ${direction} NULLS LAST
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    rows: result.rows,
    total: binding.paginate ? total : result.rows.length,
    page: served,
  };
}

/**
 * Fills `{column}` placeholders from the row.
 *
 * Only same-origin paths are produced: the pattern must start with a single
 * slash, and each substituted value is URL-encoded, so a row whose column
 * contains `../` or a full URL cannot escape the site.
 */
function rowLink(pattern: string, row: Record<string, unknown>): string | null {
  if (!pattern.startsWith('/') || pattern.startsWith('//')) return null;

  let missing = false;
  const path = pattern.replace(/\{(\w+)\}/g, (_match, column: string) => {
    const value = row[column];
    if (value === null || value === undefined || value === '') {
      missing = true;
      return '';
    }
    return encodeURIComponent(String(value));
  });

  return missing ? null : path;
}

/** Serialises values Postgres returns as objects (dates, buffers) for the client. */
function serialiseRow(row: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) output[key] = value.toISOString();
    else if (Buffer.isBuffer(value)) continue;
    else output[key] = value;
  }
  return output;
}

/**
 * Returns a copy of the tree with `items` / `data` populated from the tenant
 * database. Failures degrade to an empty list rather than breaking the page.
 */
export async function resolveDataBindings(
  platformId: string,
  nodes: ComponentNode[],
  page = 1,
): Promise<ComponentNode[]> {
  const bindings = collectBindings(nodes);
  if (bindings.size === 0) return nodes;

  const allowed = await readableTables(platformId).catch(() => new Set<string>());
  const cache = new Map<string, PagedRows>();

  await Promise.all(
    [...bindings.entries()].map(async ([table, list]) => {
      if (!allowed.has(table)) return;
      for (const binding of list) {
        const key = JSON.stringify(binding);
        if (cache.has(key)) continue;
        try {
          const result = await fetchRows(platformId, binding, page);
          cache.set(key, { rows: result.rows.map(serialiseRow), total: result.total, page: result.page });
        } catch (error) {
          console.error(`[seo] unable to resolve data binding for '${table}'`, error);
          cache.set(key, { rows: [], total: 0, page: 1 });
        }
      }
    }),
  );

  const apply = (node: ComponentNode): ComponentNode => {
    const binding = readBinding(node);
    const result = binding ? cache.get(JSON.stringify(binding)) : undefined;

    if (!result) {
      return { ...node, children: node.children?.map(apply) };
    }

    const rows = binding?.linkPattern
      ? result.rows.map((row) => {
        const url = rowLink(binding.linkPattern as string, row);
        return url ? { ...row, url } : row;
      })
      : result.rows;

    const limit = Math.min(Math.max(binding?.limit ?? 6, 1), MAX_ROWS);
    const pager = binding?.paginate
      ? { page: result.page, pageCount: Math.max(1, Math.ceil(result.total / limit)), total: result.total }
      : {};

    return {
      ...node,
      props: { ...node.props, items: rows, data: rows, ...pager },
      children: node.children?.map(apply),
    };
  };

  return nodes.map(apply);
}
