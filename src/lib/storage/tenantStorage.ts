import 'server-only';

import path from 'node:path';
import { getCoreDb } from '@/lib/db/coreDb';

/**
 * Filesystem roots for the File Manager.
 *
 * Uploads are tenant data, so every site writes beneath its own directory —
 * `<STORAGE_ROOT>/<tenantDbName>/` — and can never read or write another
 * tenant's files. The legacy shared YII uploads directory stays available
 * read-only so existing content keeps resolving while it is migrated.
 */

export const VIRTUAL_ROOT = '/uploads';

const STORAGE_ROOT = process.env.TENANT_STORAGE_ROOT
  || path.join(process.cwd(), 'storage', 'tenants');

/** Read-only legacy roots, used only when a tenant has no file of its own. */
const LEGACY_READ_ONLY_ROOTS = [
  path.join(process.cwd(), 'public', 'YII', 'yang-main', 'backend', 'web', 'uploads'),
  path.join(process.cwd(), 'public', 'YII', 'yang-main', 'frontend', 'web', 'uploads'),
];

const SAFE_DB_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

export class StorageError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'StorageError';
  }
}

/** Rejects `..`, absolute paths and anything that escapes the tenant root. */
export function cleanRelative(value = ''): string {
  const normalized = value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^uploads\/?/, '');

  if (normalized.split('/').some((part) => part === '..' || part === '.')) {
    throw new StorageError('เส้นทางไฟล์ไม่ถูกต้อง');
  }
  return normalized;
}

export const virtualPath = (relative: string) =>
  relative ? `${VIRTUAL_ROOT}/${relative.replace(/\\/g, '/')}` : VIRTUAL_ROOT;

export interface TenantStorage {
  /** Directory this tenant may write to. */
  writeRoot: string;
  /** Directories searched when reading, most specific first. */
  readRoots: string[];
  tenantDbName: string;
  publicUrl: (relative: string) => string;
}

/**
 * Resolves the storage roots for one Site.
 *
 * Throws when the caller has no site context, so an unscoped request can never
 * fall back to a shared writable directory.
 */
export async function resolveTenantStorage(
  scope: { appId?: string; platformId?: string },
): Promise<TenantStorage> {
  const result = scope.appId
    ? await getCoreDb().query<{ tenant_db_name: string }>(
        'SELECT tenant_db_name FROM public.apps WHERE id = $1 AND is_active = TRUE',
        [scope.appId],
      )
    : await getCoreDb().query<{ tenant_db_name: string }>(
        `SELECT 'platform_' || REPLACE(platform_slug, '-', '_') AS tenant_db_name
         FROM public.platforms WHERE id = $1`,
        [scope.platformId],
      );
  if (!result.rowCount) throw new StorageError('ไม่พบ Site หรือ Platform ที่ระบุ', 404);

  const tenantDbName = result.rows[0].tenant_db_name;
  if (!SAFE_DB_NAME.test(tenantDbName)) {
    throw new StorageError('ชื่อฐานข้อมูลของ Site ไม่ถูกต้อง', 500);
  }

  const writeRoot = path.join(STORAGE_ROOT, tenantDbName);

  return {
    writeRoot,
    readRoots: [writeRoot, ...LEGACY_READ_ONLY_ROOTS],
    tenantDbName,
    publicUrl: (relative: string) => {
      const query = scope.appId
        ? `appId=${encodeURIComponent(scope.appId)}`
        : `platformId=${encodeURIComponent(scope.platformId ?? '')}`;
      return `/api/file-manager/raw?${query}&path=${encodeURIComponent(relative)}`;
    },
  };
}

/** Absolute path inside the tenant's writable root; throws if it escapes. */
export function resolveWritePath(storage: TenantStorage, relative: string): string {
  const clean = cleanRelative(relative);
  const absolute = path.resolve(storage.writeRoot, clean);

  if (absolute !== storage.writeRoot && !absolute.startsWith(`${storage.writeRoot}${path.sep}`)) {
    throw new StorageError('เส้นทางไฟล์อยู่นอกขอบเขตของ Site นี้', 403);
  }
  return absolute;
}
