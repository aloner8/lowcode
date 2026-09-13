import type { JsonValue, TemplateDefinition } from "./contracts";

const SENSITIVE_KEY = /(?:password|passwd|secret|token|api[_-]?key|credential|connection[_-]?(?:profile|ref|string)|private[_-]?key)/i;
const SECRET_REFERENCE = /(?:env|secret):\/\//i;

const sanitize = (value: unknown): JsonValue | undefined => {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return SECRET_REFERENCE.test(value) ? undefined : value;
  if (Array.isArray(value)) {
    return value.map(sanitize).filter((item): item is JsonValue => item !== undefined);
  }
  if (!value || typeof value !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, item]) => [key, sanitize(item)] as const)
      .filter((entry): entry is readonly [string, JsonValue] => entry[1] !== undefined),
  );
};

export interface PublicTemplateExport {
  format: "lowcode-public-template";
  formatVersion: 1;
  schemaVersion: string;
  template: {
    slug: string;
    name: string;
    description: string | null;
    revision: number;
    digest: string;
  };
  definition: JsonValue;
}

/**
 * Public copies contain reusable design/config only. Tenant identity and the
 * source revision's internal Template identity are deliberately omitted.
 */
export function createPublicTemplateExport(input: {
  slug: string;
  name: string;
  description: string | null;
  revision: number;
  digest: string;
  definition: TemplateDefinition;
}): PublicTemplateExport {
  const { template: _privateIdentity, ...portableDefinition } = input.definition;
  return {
    format: "lowcode-public-template",
    formatVersion: 1,
    schemaVersion: input.definition.schemaVersion,
    template: {
      slug: input.slug,
      name: input.name,
      description: input.description,
      revision: input.revision,
      digest: input.digest,
    },
    definition: sanitize(portableDefinition) ?? {},
  };
}
