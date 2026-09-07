import type { JsonSchema } from './contracts.js';

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

const valueType = (value: unknown) => Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;

function validateAt(schema: JsonSchema, value: unknown, path: string, errors: string[]): void {
  if (value === undefined) return;
  const actual = valueType(value);
  if (schema.type === 'object' && actual !== 'object') errors.push(`${path} must be an object`);
  if (schema.type === 'array' && actual !== 'array') errors.push(`${path} must be an array`);
  if (schema.type === 'string' && actual !== 'string') errors.push(`${path} must be a string`);
  if (schema.type === 'boolean' && actual !== 'boolean') errors.push(`${path} must be a boolean`);
  if (schema.type === 'number' && (actual !== 'number' || !Number.isFinite(value))) errors.push(`${path} must be a number`);
  if (schema.type === 'integer' && (actual !== 'number' || !Number.isInteger(value))) errors.push(`${path} must be an integer`);
  if (errors.length && errors[errors.length - 1].startsWith(`${path} must be`)) return;

  if (schema.enum && !schema.enum.some((entry) => entry === value)) errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} is too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} is too long`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} has an invalid format`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be at most ${schema.maximum}`);
  }
  if (Array.isArray(value) && schema.items) value.forEach((entry, index) => validateAt(schema.items!, entry, `${path}[${index}]`, errors));
  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (record[key] === undefined || record[key] === '') errors.push(`${path}.${key} is required`);
    for (const [key, entry] of Object.entries(record)) {
      const child = schema.properties?.[key];
      if (child) validateAt(child, entry, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${key} is not allowed`);
    }
  }
}

export function validateSchema(schema: JsonSchema, value: unknown): SchemaValidationResult {
  const errors: string[] = [];
  validateAt(schema, value, '$', errors);
  return { valid: errors.length === 0, errors };
}

export function defaultsFromSchema(schema: JsonSchema): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    if (property.default !== undefined) result[key] = property.default;
  }
  return result;
}
