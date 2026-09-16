import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceExecutionContext } from '@/lib/services/runtimeContext';
import type { StudioServiceDefinition } from '@/types';
import { executeGoogleWorkspaceService } from '@/lib/services/googleWorkspaceService';

const ctx = { scope: { platformId: 'platform-a', appId: 'app-a', tenantId: 'app-a', authRealm: 'tenant' } } as ServiceExecutionContext;
const binding = { id: 'google.office', name: 'Google Office', kind: 'google', enabled: true, serviceRef: { serviceKey: 'google.workspace', version: '1.0.0' }, config: { features: ['maps', 'calendar', 'drive', 'forms', 'ai'], browserMapsKey: 'restricted-browser-key', maxPageSize: 2, requestTimeoutMs: 1000 }, secretRefs: { googleAccessToken: 'env://LOWCODE_CONNECTION_GOOGLE_ACCESS_TOKEN', googleGeminiApiKey: 'env://LOWCODE_CONNECTION_GEMINI_API_KEY' }, policy: { allowedOperations: [] }, containerBindings: [] } as StudioServiceDefinition;

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Google Workspace adapter', () => {
  it('uses a fixed Calendar endpoint, bounded page size and a server-side Bearer token', async () => {
    vi.stubEnv('LOWCODE_CONNECTION_GOOGLE_ACCESS_TOKEN', 'access-token');
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ items: [{ id: 'event-1', summary: 'Meeting' }], nextPageToken: 'next' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await executeGoogleWorkspaceService(ctx, binding, 'calendarList', { calendarId: 'office calendar' });
    expect(result).toEqual({ events: [{ id: 'event-1', summary: 'Meeting' }], nextPageToken: 'next' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/calendars/office%20calendar/events');
    expect(new URL(String(url)).searchParams.get('maxResults')).toBe('2');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
  });

  it('returns only a domain-restricted Maps embed URL from binding config', async () => {
    const result = await executeGoogleWorkspaceService(ctx, binding, 'mapsEmbedUrl', { lat: 13.7563, lng: 100.5018, zoom: 12 }) as { url: string };
    const url = new URL(result.url);
    expect(url.origin).toBe('https://www.google.com');
    expect(url.searchParams.get('center')).toBe('13.7563,100.5018');
    expect(url.searchParams.get('key')).toBe('restricted-browser-key');
  });

  it('rejects unsupported structured-output constraints before calling Gemini', async () => {
    vi.stubEnv('LOWCODE_CONNECTION_GEMINI_API_KEY', 'gemini-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(executeGoogleWorkspaceService(ctx, binding, 'aiGenerate', {
      prompt: 'Return a code',
      outputSchema: { type: 'string', pattern: '^[A-Z]+$' },
    })).rejects.toMatchObject({ code: 'SERVICE_INPUT_INVALID', status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects excessively deep structured-output schemas before calling Gemini', async () => {
    vi.stubEnv('LOWCODE_CONNECTION_GEMINI_API_KEY', 'gemini-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    let nested: Record<string, unknown> = { type: 'string' };
    for (let index = 0; index < 8; index += 1) nested = { type: 'array', items: nested };

    await expect(executeGoogleWorkspaceService(ctx, binding, 'aiGenerate', {
      prompt: 'Return nested output',
      outputSchema: nested,
    })).rejects.toMatchObject({ code: 'SERVICE_INPUT_INVALID', status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
