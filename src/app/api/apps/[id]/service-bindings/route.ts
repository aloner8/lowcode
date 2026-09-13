import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireSiteSession } from '@/lib/auth/apiAuth';
import { resolveAppServiceBindings } from '@/lib/services/appBindings';
import { validateServiceBinding } from '@/lib/services/bindings';
import { validateAppBindingOverridePolicy } from '@/lib/services/configPolicy';
import { validateBindingSecretReferences } from '@/lib/services/secrets';
import type { StudioServiceDefinition } from '@/types';
import { getServiceDefinition } from '@/lib/services/catalog';

async function appScope(id: string) {
  const result = await getCoreDb().query<{ platform_id: string; studio_services: unknown }>('SELECT a.platform_id,p.studio_services FROM public.apps a JOIN public.platforms p ON p.id=a.platform_id WHERE a.id=$1 AND a.is_active', [id]);
  return result.rowCount ? result.rows[0] : null;
}
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const auth = await requireSiteSession(id, 'VIEWER'); if (auth instanceof NextResponse) return auth;
  const scope = await appScope(id); if (!scope) return NextResponse.json({ error: 'App not found' }, { status: 404 });
  return NextResponse.json({ services: await resolveAppServiceBindings(scope.platform_id, id, scope.studio_services) });
}
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const auth = await requireSiteSession(id, 'ADMIN'); if (auth instanceof NextResponse) return auth;
  const scope = await appScope(id); if (!scope) return NextResponse.json({ error: 'App not found' }, { status: 404 });
  const input = await request.json().catch(() => null) as StudioServiceDefinition | null;
  if (!input) return NextResponse.json({ error: 'Binding is required' }, { status: 400 });
  const checked = validateServiceBinding(input);
  const policy = validateAppBindingOverridePolicy(scope.studio_services, checked.binding);
  const errors = [...checked.errors, ...policy.errors, ...validateBindingSecretReferences(policy.binding)];
  if (errors.length) return NextResponse.json({ valid: false, errors }, { status: 422 });
  const binding = policy.binding;
  const definition = getServiceDefinition(binding.serviceRef!.serviceKey, binding.serviceRef!.version)!;
  await getCoreDb().query(`INSERT INTO public.service_definitions(service_key,version,display_name,kind,lifecycle,definition) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(service_key,version) DO UPDATE SET definition=excluded.definition,display_name=excluded.display_name,kind=excluded.kind,lifecycle=excluded.lifecycle`, [definition.serviceKey, definition.version, definition.displayName, definition.kind, definition.lifecycle, JSON.stringify(definition)]);
  await getCoreDb().query(
    `INSERT INTO public.app_service_bindings(binding_key,platform_id,app_id,service_key,service_version,enabled,config,secret_refs,policy,status,updated_by)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,'published',$10)
     ON CONFLICT(platform_id,app_id,binding_key) DO UPDATE SET service_key=excluded.service_key,service_version=excluded.service_version,enabled=excluded.enabled,config=excluded.config,secret_refs=excluded.secret_refs,policy=excluded.policy,status='published',revision=app_service_bindings.revision+1,updated_by=excluded.updated_by,updated_at=now()`,
    [binding.id, scope.platform_id, id, binding.serviceRef!.serviceKey, binding.serviceRef!.version, binding.enabled, JSON.stringify(binding.config), JSON.stringify(binding.secretRefs || {}), JSON.stringify(binding.policy || { allowedOperations: [] }), auth.actor],
  );
  return NextResponse.json({ valid: true, binding: { ...binding, scope: 'app', status: 'published' } });
}
