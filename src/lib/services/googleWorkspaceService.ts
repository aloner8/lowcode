import 'server-only';
import { readFile, stat } from 'node:fs/promises';
import { resolveTenantStorage, resolveWritePath, cleanRelative } from '@/lib/storage/tenantStorage';
import { resolveSecretReference } from './secrets';
import { ServiceError } from './errors';
import { validateSchema } from './schemaValidator';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';
import type { JsonSchema } from '@/types';

const enabledFeatures = (binding: StudioServiceDefinition) => new Set(Array.isArray(binding.config.features) ? binding.config.features.map(String) : []);
const requireFeature = (binding: StudioServiceDefinition, feature: string) => {
  if (!enabledFeatures(binding).has(feature)) throw new ServiceError('OPERATION_NOT_ALLOWED', `Google ${feature} is not enabled`, 403);
};

function safeOutputSchema(value: unknown, depth = 0): JsonSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 6) throw new ServiceError('SERVICE_INPUT_INVALID', 'AI output schema is invalid or too deep', 400);
  const schema = value as Record<string, unknown>;
  const allowedKeys = new Set(['type', 'properties', 'required', 'items', 'enum', 'additionalProperties', 'minimum', 'maximum', 'minLength', 'maxLength', 'title', 'description']);
  if (Object.keys(schema).some((key) => !allowedKeys.has(key))) throw new ServiceError('SERVICE_INPUT_INVALID', 'AI output schema contains unsupported constraints', 400);
  const result: JsonSchema = {};
  if (schema.type !== undefined) {
    if (!['object', 'array', 'string', 'number', 'integer', 'boolean'].includes(String(schema.type))) throw new ServiceError('SERVICE_INPUT_INVALID', 'AI output schema type is unsupported', 400);
    result.type = schema.type as JsonSchema['type'];
  }
  if (schema.properties !== undefined) {
    if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties) || Object.keys(schema.properties).length > 50) throw new ServiceError('SERVICE_INPUT_INVALID', 'AI output schema has too many properties', 400);
    result.properties = Object.fromEntries(Object.entries(schema.properties as Record<string, unknown>).map(([key, child]) => [key, safeOutputSchema(child, depth + 1)]));
  }
  if (schema.items !== undefined) result.items = safeOutputSchema(schema.items, depth + 1);
  if (Array.isArray(schema.required)) result.required = schema.required.filter((item): item is string => typeof item === 'string').slice(0, 50);
  if (Array.isArray(schema.enum)) result.enum = schema.enum.filter((item): item is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof item)).slice(0, 100);
  if (typeof schema.additionalProperties === 'boolean') result.additionalProperties = schema.additionalProperties;
  for (const key of ['minimum', 'maximum', 'minLength', 'maxLength'] as const) if (typeof schema[key] === 'number' && Number.isFinite(schema[key])) result[key] = schema[key];
  return result;
}

async function googleAccessToken(binding: StudioServiceDefinition): Promise<string> {
  if (binding.secretRefs?.googleAccessToken) return resolveSecretReference(binding.secretRefs.googleAccessToken);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: resolveSecretReference(binding.secretRefs?.googleRefreshToken),
      client_id: resolveSecretReference(binding.secretRefs?.googleClientId),
      client_secret: resolveSecretReference(binding.secretRefs?.googleClientSecret),
    }), signal: AbortSignal.timeout(Number(binding.config.requestTimeoutMs || 10_000)),
  });
  const payload = await response.json().catch(() => null) as { access_token?: string; error?: string } | null;
  if (!response.ok || !payload?.access_token) throw new ServiceError('PROVIDER_TEMPORARY_FAILURE', 'Google authorization must be reconnected', 503, true);
  return payload.access_token;
}

async function googleJson(binding: StudioServiceDefinition, url: URL, init?: RequestInit): Promise<Record<string, any>> {
  const token = await googleAccessToken(binding);
  const response = await fetch(url, { ...init, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) }, signal: AbortSignal.timeout(Number(binding.config.requestTimeoutMs || 10_000)) });
  const payload = await response.json().catch(() => null) as Record<string, any> | null;
  if (response.status === 401 || response.status === 403) throw new ServiceError('PROVIDER_AUTH_FAILED', 'Google authorization is missing, expired, or does not include the required scope', 401);
  if (response.status === 429) throw new ServiceError('RATE_LIMITED', 'Google quota is temporarily exhausted', 429, true);
  if (!response.ok || !payload) throw new ServiceError('PROVIDER_TEMPORARY_FAILURE', 'Google service is temporarily unavailable', 503, true);
  return payload;
}

async function tenantFile(ctx: ServiceExecutionContext, assetId: string, maxBytes: number) {
  const storage = await resolveTenantStorage(ctx.scope.appId ? { appId: ctx.scope.appId } : { platformId: ctx.scope.platformId });
  const relative = cleanRelative(assetId);
  const target = resolveWritePath(storage, relative);
  const info = await stat(target).catch(() => null);
  if (!info?.isFile()) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', 'The selected FileRef is unavailable', 404);
  if (info.size > maxBytes) throw new ServiceError('SERVICE_INPUT_INVALID', 'The selected file is too large for this provider operation', 413);
  return readFile(target);
}

export async function executeGoogleWorkspaceService(ctx: ServiceExecutionContext, binding: StudioServiceDefinition, operation: string, input: Record<string, any>) {
  const pageSize = Math.min(Number(binding.config.maxPageSize || 100), 1000);
  if (operation === 'mapsEmbedUrl') {
    requireFeature(binding, 'maps');
    const url = new URL('https://www.google.com/maps/embed/v1/view');
    url.searchParams.set('key', String(binding.config.browserMapsKey));
    url.searchParams.set('center', `${Number(input.lat)},${Number(input.lng)}`);
    url.searchParams.set('zoom', String(Number(input.zoom || 14)));
    return { url: url.toString() };
  }
  if (operation === 'calendarList') {
    requireFeature(binding, 'calendar');
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(String(input.calendarId))}/events`);
    url.searchParams.set('maxResults', String(pageSize));
    url.searchParams.set('singleEvents', 'true');
    if (input.timeMin) url.searchParams.set('timeMin', String(input.timeMin));
    if (input.timeMax) url.searchParams.set('timeMax', String(input.timeMax));
    if (input.pageToken) url.searchParams.set('pageToken', String(input.pageToken));
    const result = await googleJson(binding, url);
    return { events: result.items || [], nextPageToken: result.nextPageToken };
  }
  if (operation === 'calendarCreate') {
    requireFeature(binding, 'calendar');
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(String(input.calendarId))}/events`);
    const result = await googleJson(binding, url, { method: 'POST', body: JSON.stringify({ summary: input.title, description: input.description, start: { dateTime: input.start }, end: { dateTime: input.end } }) });
    return { event: result };
  }
  if (operation === 'driveList') {
    requireFeature(binding, 'drive');
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    const clauses = [input.folderId ? `'${String(input.folderId).replace(/'/g, "\\'")}' in parents` : '', input.query ? `(${String(input.query)})` : ''].filter(Boolean);
    if (clauses.length) url.searchParams.set('q', clauses.join(' and '));
    url.searchParams.set('pageSize', String(Math.min(pageSize, 1000)));
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)');
    if (input.pageToken) url.searchParams.set('pageToken', String(input.pageToken));
    const result = await googleJson(binding, url);
    return { files: (result.files || []).map((file: Record<string, unknown>) => ({ provider: 'google-drive', externalId: file.id, ...file })), nextPageToken: result.nextPageToken };
  }
  if (operation === 'formsGet' || operation === 'formsResponses') {
    requireFeature(binding, 'forms');
    const suffix = operation === 'formsResponses' ? '/responses' : '';
    const url = new URL(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(String(input.formId))}${suffix}`);
    if (input.pageToken) url.searchParams.set('pageToken', String(input.pageToken));
    const result = await googleJson(binding, url);
    return operation === 'formsGet' ? { form: result } : { responses: result.responses || [], nextPageToken: result.nextPageToken };
  }
  if (operation === 'visionOcr') {
    requireFeature(binding, 'vision');
    const bytes = await tenantFile(ctx, String(input.file), Number(binding.config.maxVisionBytes || 10_485_760));
    const response = await fetch('https://vision.googleapis.com/v1/images:annotate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': resolveSecretReference(binding.secretRefs?.googleVisionApiKey) }, body: JSON.stringify({ requests: [{ image: { content: bytes.toString('base64') }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }), signal: AbortSignal.timeout(Number(binding.config.requestTimeoutMs || 10_000)) });
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) throw new ServiceError(response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_TEMPORARY_FAILURE', response.status === 429 ? 'Google Vision quota is temporarily exhausted' : 'Google Vision is temporarily unavailable', response.status === 429 ? 429 : 503, true);
    return { text: payload?.responses?.[0]?.fullTextAnnotation?.text || '' };
  }
  if (operation === 'aiGenerate') {
    requireFeature(binding, 'ai');
    const model = String(binding.config.geminiModel || 'gemini-2.5-flash');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const outputSchema = input.outputSchema ? safeOutputSchema(input.outputSchema) : undefined;
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': resolveSecretReference(binding.secretRefs?.googleGeminiApiKey) }, body: JSON.stringify({ contents: [{ parts: [{ text: `${String(input.prompt)}\n\n${input.data === undefined ? '' : JSON.stringify(input.data)}` }] }], ...(outputSchema ? { generationConfig: { responseMimeType: 'application/json', responseJsonSchema: outputSchema } } : {}) }), signal: AbortSignal.timeout(Number(binding.config.requestTimeoutMs || 10_000)) });
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) throw new ServiceError(response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_TEMPORARY_FAILURE', response.status === 429 ? 'Gemini quota is temporarily exhausted' : 'Gemini is temporarily unavailable', response.status === 429 ? 429 : 503, true);
    const text = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || '');
    if (outputSchema) {
      let value: unknown;
      try { value = JSON.parse(text); } catch { throw new ServiceError('PROVIDER_TEMPORARY_FAILURE', 'Gemini returned invalid structured output', 502, true); }
      const validation = validateSchema(outputSchema, value);
      if (!validation.valid) throw new ServiceError('PROVIDER_TEMPORARY_FAILURE', 'Gemini structured output did not match the requested schema', 502, true);
      return { value };
    }
    return { text };
  }
  throw new ServiceError('OPERATION_NOT_ALLOWED', `Unsupported Google operation '${operation}'`, 405);
}
