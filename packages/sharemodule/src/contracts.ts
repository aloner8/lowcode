export type SharedServiceKind = "auth" | "data" | "storage" | "notification";
export type SharedServiceBindingStatus = "draft" | "valid" | "invalid" | "published";

export interface ServiceOperationDefinition {
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  requiredPermission?: string;
  execution: "sync" | "async";
  idempotency: "none" | "supported" | "required";
}

export interface JsonSchema {
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean";
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: Array<string | number | boolean>;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean;
}

export interface SharedServiceDefinition {
  serviceKey: string;
  displayName: string;
  kind: SharedServiceKind;
  version: string;
  lifecycle: "active" | "deprecated" | "retired";
  operations: Record<string, ServiceOperationDefinition>;
  propertySchema: JsonSchema;
  defaultConfig: Record<string, unknown>;
}


export * from './errors.js';
export * from './schemaValidator.js';
