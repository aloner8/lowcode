import type {
  AppComponentInstanceDefinition,
  JsonValue,
} from "@/lib/template/contracts";

const record = (value: JsonValue | undefined): Record<string, JsonValue> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : null;

export const resolveBindingPath = (
  data: Record<string, JsonValue>,
  path: string,
): JsonValue | undefined => {
  const parts = path.split(".").map((part) => part.trim()).filter(Boolean);
  if (!parts.length || !(parts[0] in data)) return undefined;
  let current: JsonValue | undefined = data[parts[0]];
  for (const part of parts.slice(1)) {
    if (Array.isArray(current)) {
      if (part === "rows") continue;
      current = current.map((item) => record(item)?.[part] ?? null);
      continue;
    }
    const source = record(current);
    if (!source || !(part in source)) return undefined;
    current = source[part];
  }
  return current;
};

export const resolveComponentProps = (
  instance: AppComponentInstanceDefinition,
  data: Record<string, JsonValue>,
): Record<string, JsonValue> => {
  const resolved = { ...instance.props };
  Object.entries(instance.bindings).forEach(([property, path]) => {
    const value = resolveBindingPath(data, path);
    if (value !== undefined) resolved[property] = value;
  });
  return resolved;
};
