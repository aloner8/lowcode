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

async function fetchRows(
  platformId: string,
  binding: DataSourceBinding,
): Promise<Record<string, unknown>[]> {
  const { pool } = await getTenantDb(platformId);
  const table = binding.table as string;

  const columns = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  if (!columns.rowCount) return [];
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
  params.push(limit);

  const result = await pool.query(
    `SELECT * FROM public.${quote(table)} ${where}
     ORDER BY ${quote(orderColumn)} ${direction} NULLS LAST
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
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
): Promise<ComponentNode[]> {
  const bindings = collectBindings(nodes);
  if (bindings.size === 0) return nodes;

  const allowed = await readableTables(platformId).catch(() => new Set<string>());
  const cache = new Map<string, Record<string, unknown>[]>();

  await Promise.all(
    [...bindings.entries()].map(async ([table, list]) => {
      if (!allowed.has(table)) return;
      for (const binding of list) {
        const key = JSON.stringify(binding);
        if (cache.has(key)) continue;
        try {
          cache.set(key, (await fetchRows(platformId, binding)).map(serialiseRow));
        } catch (error) {
          console.error(`[seo] unable to resolve data binding for '${table}'`, error);
          cache.set(key, []);
        }
      }
    }),
  );

  const apply = (node: ComponentNode): ComponentNode => {
    const binding = readBinding(node);
    const rows = binding ? cache.get(JSON.stringify(binding)) : undefined;

    return {
      ...node,
      props: rows ? { ...node.props, items: rows, data: rows } : node.props,
      children: node.children?.map(apply),
    };
  };

  return nodes.map(apply);
}
