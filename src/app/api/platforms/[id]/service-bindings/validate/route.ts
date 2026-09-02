import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { validateServiceBinding } from '@/lib/services/bindings';
import type { StudioServiceDefinition } from '@/types';
import { validateBindingSecretReferences } from '@/lib/services/secrets';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const auth = await requirePlatformSession(id, 'STAFF'); if (auth instanceof NextResponse) return auth;
  const binding = await request.json().catch(() => null) as StudioServiceDefinition | null;
  if (!binding?.id || !binding.name || !binding.config) return NextResponse.json({ valid: false, errors: ['Binding id, name and config are required'] }, { status: 400 });
  const result = validateServiceBinding(binding); const errors = [...result.errors, ...validateBindingSecretReferences(result.binding)];
  const valid = errors.length === 0; const checked = { ...result.binding, status: valid ? 'valid' as const : 'invalid' as const, validationErrors: errors };
  return NextResponse.json({ valid, errors, binding: checked }, { status: valid ? 200 : 422 });
}
