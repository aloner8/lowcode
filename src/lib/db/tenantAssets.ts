import { createHash } from 'node:crypto';
import { getTenantDb } from './tenantDb';
import type { PlatformAsset } from '@/types';

/**
 * Uploaded files are tenant data, so they live in the tenant's own database
 * (`sys.assets`) — never in the core control-plane database. Bytes are stored
 * in Postgres so runtime containers stay stateless and a tenant's files travel
 * with its database.
 */

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 100 * 1024 * 1024);

const ALLOWED_CONTENT_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/json', 'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export class AssetError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'AssetError';
  }
}

interface AssetRow {
  id: string;
  file_name: string;
  content_type: string;
  byte_size: string;
  checksum: string;
  uploaded_by: string;
  created_at: Date;
}

function toAsset(row: AssetRow, platformId: string): PlatformAsset {
  return {
    id: row.id,
    platformId,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    checksum: row.checksum,
    url: `/api/platforms/${platformId}/assets/${row.id}`,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at.toISOString(),
  };
}

/** Strips directory components and characters that break Content-Disposition. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'upload';
  const cleaned = base.replace(/[\u0000-\u001f"\\]/g, '').trim();
  return (cleaned || 'upload').slice(0, 255);
}

export async function listTenantAssets(platformId: string): Promise<PlatformAsset[]> {
  const { pool } = await getTenantDb(platformId);
  const result = await pool.query<AssetRow>(
    `SELECT id, file_name, content_type, byte_size::text, checksum, uploaded_by, created_at
     FROM sys.assets ORDER BY created_at DESC LIMIT 500`,
  );
  return result.rows.map((row) => toAsset(row, platformId));
}

export async function storeTenantAsset(
  platformId: string,
  file: { name: string; type: string; bytes: Buffer },
  uploadedBy: string,
): Promise<PlatformAsset> {
  if (!file.bytes.length) throw new AssetError('ไฟล์ว่างเปล่า');
  if (file.bytes.length > MAX_UPLOAD_BYTES) {
    throw new AssetError(`ไฟล์ใหญ่เกิน ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`, 413);
  }

  const contentType = (file.type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new AssetError(`ชนิดไฟล์ '${contentType}' ไม่ได้รับอนุญาต`, 415);
  }

  const checksum = createHash('sha256').update(file.bytes).digest('hex');
  const { pool } = await getTenantDb(platformId);

  // Same bytes uploaded twice reuse the existing row instead of duplicating storage.
  const result = await pool.query<AssetRow>(
    `INSERT INTO sys.assets (file_name, content_type, byte_size, checksum, content, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (checksum) DO UPDATE SET file_name = excluded.file_name
     RETURNING id, file_name, content_type, byte_size::text, checksum, uploaded_by, created_at`,
    [safeFileName(file.name), contentType, file.bytes.length, checksum, file.bytes, uploadedBy],
  );
  return toAsset(result.rows[0], platformId);
}

export async function readTenantAsset(
  platformId: string,
  assetId: string,
): Promise<{ fileName: string; contentType: string; content: Buffer }> {
  const { pool } = await getTenantDb(platformId);
  const result = await pool.query<{ file_name: string; content_type: string; content: Buffer }>(
    'SELECT file_name, content_type, content FROM sys.assets WHERE id = $1',
    [assetId],
  );
  if (!result.rowCount) throw new AssetError('ไม่พบไฟล์ที่ระบุ', 404);
  return {
    fileName: result.rows[0].file_name,
    contentType: result.rows[0].content_type,
    content: result.rows[0].content,
  };
}

export async function deleteTenantAsset(platformId: string, assetId: string): Promise<boolean> {
  const { pool } = await getTenantDb(platformId);
  const result = await pool.query('DELETE FROM sys.assets WHERE id = $1', [assetId]);
  if (!result.rowCount) throw new AssetError('ไม่พบไฟล์ที่ต้องการลบ', 404);
  return true;
}
