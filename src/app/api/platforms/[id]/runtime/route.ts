import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { dockerAvailable, dockerRequest } from '@/lib/docker/dockerEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RuntimeRow {
  id: string; platform_slug: string; platform_name: string; master_theme_config: unknown;
  studio_pages: unknown[]; studio_forms: unknown[]; studio_collections: unknown[]; studio_initialized: boolean; content_updated_at: Date;
  runtime_path: string | null; runtime_image: string | null; runtime_container_name: string | null;
  runtime_status: string; runtime_built_at: Date | null; runtime_source_updated_at: Date | null;
  runtime_build_revision: string | null; runtime_port: number | null; runtime_error: string | null;
  runtime_surfaces: Record<string, { containerName: string; port: number | null; url: string | null }>;
}

const selectRuntime = `SELECT id, platform_slug, platform_name, master_theme_config, studio_pages, studio_forms, studio_collections,
 studio_initialized, content_updated_at, runtime_path, runtime_image, runtime_container_name,
 runtime_status, runtime_built_at, runtime_source_updated_at, runtime_build_revision, runtime_port, runtime_error, runtime_surfaces
 FROM public.platforms WHERE id = $1`;

function statusPayload(row: RuntimeRow, dockerConnected: boolean) {
  const stale = !row.runtime_source_updated_at || row.content_updated_at > row.runtime_source_updated_at;
  return {
    dockerConnected,
    exists: Boolean(row.runtime_image && row.runtime_built_at),
    stale,
    status: stale && row.runtime_built_at ? 'stale' : row.runtime_status,
    runtimePath: row.runtime_path || `/platform-runtime/${row.platform_slug}`,
    image: row.runtime_image,
    containerName: row.runtime_container_name,
    buildRevision: row.runtime_build_revision,
    builtAt: row.runtime_built_at?.toISOString() || null,
    sourceUpdatedAt: row.content_updated_at.toISOString(),
    port: row.runtime_port,
    url: row.runtime_port ? `http://localhost:${row.runtime_port}/app/${row.platform_slug}` : null,
    error: row.runtime_error,
    surfaces: row.runtime_surfaces || {},
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await getCoreDb().query<RuntimeRow>(selectRuntime, [id]);
  if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
  return NextResponse.json({ runtime: statusPayload(result.rows[0], await dockerAvailable()) });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await getCoreDb().query<RuntimeRow>(selectRuntime, [id]);
  if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
  const platform = result.rows[0];
  if (!platform.studio_initialized || !Array.isArray(platform.studio_pages) || platform.studio_pages.length === 0) {
    return NextResponse.json({ error: 'Platform ยังไม่มี Page data สำหรับสร้าง Runtime' }, { status: 409 });
  }
  if (!(await dockerAvailable())) {
    return NextResponse.json({ error: 'Docker Engine ยังไม่พร้อมใช้งาน หรือไม่ได้ mount Docker socket' }, { status: 503 });
  }

  const snapshot = {
    platformId: platform.id,
    platformSlug: platform.platform_slug,
    platformName: platform.platform_name,
    themeConfig: platform.master_theme_config,
    pages: platform.studio_pages,
    forms: platform.studio_forms || [],
    collections: platform.studio_collections || [],
    generatedAt: new Date().toISOString(),
  };
  const revision = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 12);
  const repository = `lowcode-platform-${platform.platform_slug}`;
  const image = `${repository}:${revision}`;
  const containerBase = `lowcode_platform_${platform.platform_slug.replace(/-/g, '_')}`;

  try {
    await getCoreDb().query(`UPDATE public.platforms SET runtime_status='building', runtime_error=NULL WHERE id=$1`, [id]);
    const tag = await dockerRequest('POST', `/images/${encodeURIComponent(process.env.PLATFORM_RUNTIME_BASE_IMAGE || 'lowcode-app:latest')}/tag?repo=${encodeURIComponent(repository)}&tag=${revision}`);
    if (tag.statusCode >= 300) throw new Error(`Unable to tag runtime image: ${JSON.stringify(tag.data)}`);

    const coreUrl = new URL(process.env.CORE_DATABASE_URL || '');
    coreUrl.pathname = `/platform_${platform.platform_slug.replace(/-/g, '_')}`;
    const surfaces: Record<string, { containerName: string; port: number | null; url: string | null }> = {};
    for (const surface of ['frontend', 'backend'] as const) {
      const containerName = `${containerBase}_${surface}`;
      const existing = await dockerRequest('GET', `/containers/${encodeURIComponent(containerName)}/json`);
      if (existing.statusCode === 200) { await dockerRequest('POST', `/containers/${encodeURIComponent(containerName)}/stop?t=5`); await dockerRequest('DELETE', `/containers/${encodeURIComponent(containerName)}?force=true`); }
      const create = await dockerRequest<{ Id?: string; message?: string }>('POST', `/containers/create?name=${encodeURIComponent(containerName)}`, {
        Image: image, Env: ['PORT=33000', `APP_SURFACE=${surface}`, `PLATFORM_ID=${platform.id}`, `PLATFORM_SLUG=${platform.platform_slug}`, `TENANT_DATABASE_URL=${coreUrl.toString()}`, `CORE_DATABASE_URL=${process.env.CORE_DATABASE_URL || ''}`, 'CORE_DB_SCHEMA=public'],
        ExposedPorts: { '33000/tcp': {} }, HostConfig: { PortBindings: { '33000/tcp': [{ HostPort: '' }] }, NetworkMode: process.env.PLATFORM_RUNTIME_NETWORK || 'lowcode_network' },
      });
      if (create.statusCode >= 300 || !create.data.Id) throw new Error(create.data.message || `Unable to create ${surface} runtime`);
      const start = await dockerRequest('POST', `/containers/${create.data.Id}/start`);
      if (start.statusCode >= 300) throw new Error(`Unable to start ${surface} runtime`);
      const inspect = await dockerRequest<{ NetworkSettings?: { Ports?: Record<string, Array<{ HostPort: string }> | null> } }>('GET', `/containers/${create.data.Id}/json`);
      const surfacePort = Number(inspect.data.NetworkSettings?.Ports?.['33000/tcp']?.[0]?.HostPort || 0) || null;
      surfaces[surface] = { containerName, port: surfacePort, url: surfacePort ? `http://localhost:${surfacePort}/app/${platform.platform_slug}` : null };
    }
    const port = surfaces.frontend.port;

    await getCoreDb().query(`UPDATE public.platforms SET runtime_path=$2, runtime_image=$3,
      runtime_container_name=$4, runtime_status='running', runtime_built_at=NOW(),
      runtime_source_updated_at=content_updated_at, runtime_build_revision=$5,
      runtime_snapshot=$6::jsonb, runtime_port=$7, runtime_surfaces=$8::jsonb, runtime_error=NULL WHERE id=$1`,
      [id, `/platform-runtime/${platform.platform_slug}`, image, containerBase, revision, JSON.stringify(snapshot), port, JSON.stringify(surfaces)]);
    const updated = await getCoreDb().query<RuntimeRow>(selectRuntime, [id]);
    return NextResponse.json({ runtime: statusPayload(updated.rows[0], true) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Runtime build failed';
    await getCoreDb().query(`UPDATE public.platforms SET runtime_status='error', runtime_error=$2 WHERE id=$1`, [id, message]);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
