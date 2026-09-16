export interface MailTemplateDefinition {
  subject: string;
  html: string;
}

export type MailTemplateMap = Record<string, MailTemplateDefinition>;

const TEMPLATE_ID = /^[a-z][a-z0-9._-]{0,79}$/;

export function normalizeMailTemplates(value: unknown): MailTemplateMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([id, template]) => {
    if (!TEMPLATE_ID.test(id) || !template || typeof template !== 'object' || Array.isArray(template)) return [];
    const candidate = template as Record<string, unknown>;
    if (typeof candidate.subject !== 'string' || typeof candidate.html !== 'string') return [];
    return [[id, { subject: candidate.subject, html: candidate.html }]];
  }));
}

export function isValidMailTemplateId(id: string): boolean {
  return TEMPLATE_ID.test(id);
}

export function setMailTemplate(templates: unknown, id: string, template: MailTemplateDefinition): MailTemplateMap {
  if (!isValidMailTemplateId(id)) throw new Error('Template ID must start with a letter and use only letters, numbers, dot, underscore or dash');
  return { ...normalizeMailTemplates(templates), [id]: template };
}

export function removeMailTemplate(templates: unknown, id: string): MailTemplateMap {
  const next = normalizeMailTemplates(templates);
  delete next[id];
  return next;
}

function valueAt(variables: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, variables);
}

export function renderMailTemplatePreview(source: string, variables: Record<string, unknown>): string {
  return source.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = valueAt(variables, key);
    return value === null || value === undefined ? '' : String(value);
  });
}
