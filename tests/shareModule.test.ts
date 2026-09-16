import { describe, expect, it, vi } from 'vitest';
import { createModules, createFilePicker, ModuleError } from '@matchanu/sharemodule/client';
import { selectModuleBinding } from '@matchanu/sharemodule/server';
import { resolveModuleOperation } from '@matchanu/sharemodule/registry';
import { normalizeServiceBinding, validateServiceBinding } from '@/lib/services/bindings';
import { validateServicesForPublish } from '@/lib/services/publishValidation';
import { createDefaultJwtAuthService } from '@/types';

describe('module selection', () => {
  const mail = (id: string, enabled = true) => ({ id, enabled, serviceRef: { serviceKey: 'notification.email', version: '1.0.0' } });
  it('selects the only configured connection without asking the developer for its ID', () => {
    expect(selectModuleBinding([mail('office')], 'notification.email').id).toBe('office');
    expect(resolveModuleOperation('mail', 'send')).toEqual({ serviceKey: 'notification.email', operation: 'sendTemplate' });
  });
  it('requires an explicit default when there are multiple connections', () => {
    expect(() => selectModuleBinding([mail('a'), mail('b')], 'notification.email')).toThrow('default connection');
    expect(selectModuleBinding([mail('a'), mail('b')], 'notification.email', 'b').id).toBe('b');
    expect(() => selectModuleBinding([mail('a')], 'notification.email', 'missing')).toThrow();
  });
  it('does not enable a disabled module or expose prototype properties as operations', () => {
    expect(() => selectModuleBinding([mail('a', false)], 'notification.email')).toThrow('disabled');
    expect(resolveModuleOperation('__proto__', 'send')).toBeNull();
    expect(resolveModuleOperation('mail', 'constructor')).toBeNull();
    expect(resolveModuleOperation('mail', 'arbitraryOperation')).toBeNull();
  });
});

describe('runtime version compatibility', () => {
  it('preserves and rejects unavailable versions instead of silently upgrading', () => {
    const binding = createDefaultJwtAuthService('demo');
    binding.serviceRef = { serviceKey: 'auth.session', version: '99.0.0' };
    expect(normalizeServiceBinding(binding).serviceRef?.version).toBe('99.0.0');
    expect(validateServiceBinding(binding).valid).toBe(false);
    expect(validateServicesForPublish([binding], []).errors.join(' ')).toContain('99.0.0');
  });
});

describe('typed module client', () => {
  it('maps simple mail properties and keeps an explicit retry key stable', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { jobId: 'job', status: 'queued' } })));
    const modules = createModules({ baseUrl: '/api/runtime/town/modules', fetch: fetcher });
    expect(await modules.mail.send({ to: 'user@example.com', template: 'welcome' }, { idempotencyKey: 'business-event-1' })).toEqual({ jobId: 'job', status: 'queued' });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/runtime/town/modules/mail/send');
    expect(JSON.parse(init!.body as string)).toEqual({ to: 'user@example.com', cc: [], templateId: 'welcome', variables: {}, attachments: [] });
    expect(new Headers(init!.headers).get('Idempotency-Key')).toBe('business-event-1');
    expect(init!.credentials).toBe('same-origin');
  });
  it('creates an idempotency key for ordinary send calls', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ data: {} })));
    await createModules({ fetch: fetcher }).mail.send({ to: 'user@example.com', template: 'welcome' });
    expect(new Headers(fetcher.mock.calls[0][1]!.headers).get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('returns structured failures and never treats malformed success as success', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'PERMISSION_DENIED', message: 'No access' }, meta: { requestId: 'r1' } }), { status: 403 })).mockResolvedValueOnce(new Response('{}'));
    const modules = createModules({ fetch: fetcher });
    await expect(modules.auth.me()).rejects.toMatchObject({ code: 'PERMISSION_DENIED', requestId: 'r1', status: 403 });
    await expect(modules.auth.me()).rejects.toBeInstanceOf(ModuleError);
  });
  it('does not infer permissions from roles in the browser', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { user: { roles: ['admin'], permissions: [] } } })));
    expect(await createModules({ fetch: fetcher }).auth.can('storage.delete')).toBe(false);
  });
});

describe('file picker lifecycle', () => {
  const file = { id: 'file.pdf', name: 'file.pdf', path: '/uploads/file.pdf', url: '/api/file-manager/raw?path=file.pdf' };
  it('returns a single file or an array according to the multiple property', async () => {
    const controller = createFilePicker(vi.fn());
    const single = controller.api.pick({ currentPath: '/documents' });
    controller.finish([file]);
    expect(await single).toEqual(file);
    const multiple = controller.api.pick({ multiple: true });
    controller.finish([file]);
    expect(await multiple).toEqual([file]);
  });
  it('settles cancellation and rejects overlapping calls without losing the original', async () => {
    const controller = createFilePicker(vi.fn());
    const single = controller.api.pick();
    await expect(controller.api.pick()).rejects.toThrow('already open');
    controller.cancel();
    expect(await single).toBeNull();
    const multiple = controller.api.pick({ multiple: true });
    controller.cancel();
    expect(await multiple).toEqual([]);
  });
});
