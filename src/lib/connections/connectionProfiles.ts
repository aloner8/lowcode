export const CONNECTION_PROFILE_TYPES = ["POSTGRES", "HTTP", "OBJECT_STORAGE", "SMTP"] as const;
export type ConnectionProfileType = (typeof CONNECTION_PROFILE_TYPES)[number];
export type ConnectionProfileStatus = "DRAFT" | "READY" | "DISABLED" | "ERROR";

export interface ConnectionProfilePolicy {
  allowedModuleKeys: string[];
  allowRuntimeWrite: boolean;
}

export interface ConnectionProfileInput {
  profileKey: string;
  profileName: string;
  profileType: ConnectionProfileType;
  config: Record<string, unknown>;
  secretRefs: Record<string, string>;
  policy: ConnectionProfilePolicy;
}

export interface ConnectionProfileValidationResult {
  valid: boolean;
  errors: string[];
  value?: ConnectionProfileInput;
}

export interface ConnectionProfileRow {
  id: string;
  customer_id: string;
  profile_key: string;
  profile_name: string;
  profile_type: ConnectionProfileType;
  config: Record<string, unknown>;
  secret_refs: Record<string, string>;
  policy: ConnectionProfilePolicy;
  status: ConnectionProfileStatus;
  edit_version: string | number;
  last_checked_at: Date | null;
  last_error_code: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PublicConnectionProfile {
  id: string;
  customerId: string;
  profileKey: string;
  profileName: string;
  profileType: ConnectionProfileType;
  config: Record<string, unknown>;
  policy: ConnectionProfilePolicy;
  status: ConnectionProfileStatus;
  editVersion: number;
  secretReferences: Array<{ key: string; provider: string; configured: boolean }>;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROFILE_KEY = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const DATABASE_NAME = /^[a-zA-Z_][a-zA-Z0-9_$.-]{0,127}$/;
const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const MODULE_KEY = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
export const SECRET_REFERENCE = /^env:\/\/LOWCODE_CONNECTION_[A-Z0-9_]{1,80}$/;
const SENSITIVE_CONFIG_KEY = /(?:password|passwd|secret|token|api[_-]?key|credential|connection[_-]?string|private[_-]?key)/i;

const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const unexpectedKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).filter((key) => !allowed.includes(key)).sort();

const sensitivePaths = (value: unknown, path = "config"): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => sensitivePaths(entry, `${path}[${index}]`));
  }
  const item = object(value);
  if (!item) return [];
  return Object.entries(item).flatMap(([key, entry]) => [
    ...(SENSITIVE_CONFIG_KEY.test(key) ? [`${path}.${key}`] : []),
    ...sensitivePaths(entry, `${path}.${key}`),
  ]);
};

const validUrl = (value: unknown) => {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
};

const requiredSecretKeys: Record<ConnectionProfileType, string[]> = {
  POSTGRES: ["username", "password"],
  HTTP: [],
  OBJECT_STORAGE: ["accessKeyId", "secretAccessKey"],
  SMTP: [],
};

const allowedSecretKeys: Record<ConnectionProfileType, string[]> = {
  POSTGRES: requiredSecretKeys.POSTGRES,
  HTTP: ["apiToken", "clientCertificate"],
  OBJECT_STORAGE: requiredSecretKeys.OBJECT_STORAGE,
  SMTP: ["username", "password"],
};

const validateTypeConfig = (
  type: ConnectionProfileType,
  config: Record<string, unknown>,
): string[] => {
  const errors: string[] = [];
  if (type === "POSTGRES") {
    const unexpected = unexpectedKeys(config, ["host", "port", "database", "sslMode", "poolMax"]);
    if (unexpected.length) errors.push(`Unsupported POSTGRES config: ${unexpected.join(", ")}`);
    if (typeof config.host !== "string" || !config.host.trim() || config.host.length > 255) errors.push("POSTGRES host is required");
    if (!Number.isInteger(config.port) || Number(config.port) < 1 || Number(config.port) > 65535) errors.push("POSTGRES port must be an integer from 1 to 65535");
    if (typeof config.database !== "string" || !DATABASE_NAME.test(config.database)) errors.push("POSTGRES database name is invalid");
    if (!["disable", "prefer", "require", "verify-full"].includes(String(config.sslMode))) errors.push("POSTGRES sslMode is invalid");
    if (!Number.isInteger(config.poolMax) || Number(config.poolMax) < 1 || Number(config.poolMax) > 20) errors.push("POSTGRES poolMax must be an integer from 1 to 20");
  } else if (type === "HTTP") {
    const unexpected = unexpectedKeys(config, ["baseUrl", "timeoutMs", "allowedHosts"]);
    if (unexpected.length) errors.push(`Unsupported HTTP config: ${unexpected.join(", ")}`);
    if (!validUrl(config.baseUrl)) errors.push("HTTP baseUrl must be an http(s) URL without credentials");
    if (!Number.isInteger(config.timeoutMs) || Number(config.timeoutMs) < 100 || Number(config.timeoutMs) > 60_000) errors.push("HTTP timeoutMs must be an integer from 100 to 60000");
    const hosts = Array.isArray(config.allowedHosts) ? config.allowedHosts : [];
    if (!hosts.length || hosts.some((host) => typeof host !== "string" || !host.trim() || host.includes("/"))) errors.push("HTTP allowedHosts must contain host names");
    if (validUrl(config.baseUrl) && !hosts.includes(new URL(String(config.baseUrl)).hostname)) errors.push("HTTP baseUrl host must be listed in allowedHosts");
  } else if (type === "OBJECT_STORAGE") {
    const unexpected = unexpectedKeys(config, ["endpoint", "bucket", "region", "forcePathStyle"]);
    if (unexpected.length) errors.push(`Unsupported OBJECT_STORAGE config: ${unexpected.join(", ")}`);
    if (!validUrl(config.endpoint)) errors.push("Object storage endpoint must be an http(s) URL without credentials");
    if (typeof config.bucket !== "string" || !BUCKET_NAME.test(config.bucket)) errors.push("Object storage bucket is invalid");
    if (typeof config.region !== "string" || !config.region.trim() || config.region.length > 100) errors.push("Object storage region is required");
    if (typeof config.forcePathStyle !== "boolean") errors.push("Object storage forcePathStyle must be boolean");
  } else {
    const unexpected = unexpectedKeys(config, ["host", "port", "tlsMode", "authMode", "rejectUnauthorized", "connectionTimeoutMs", "socketTimeoutMs", "defaultFromName", "defaultFromAddress"]);
    if (unexpected.length) errors.push(`Unsupported SMTP config: ${unexpected.join(", ")}`);
    if (typeof config.host !== "string" || !config.host.trim() || config.host.length > 255) errors.push("SMTP host is required");
    if (!Number.isInteger(config.port) || Number(config.port) < 1 || Number(config.port) > 65535) errors.push("SMTP port must be an integer from 1 to 65535");
    if (!["none", "starttls", "tls"].includes(String(config.tlsMode))) errors.push("SMTP tlsMode is invalid");
    if (!["none", "basic"].includes(String(config.authMode))) errors.push("SMTP authMode is invalid");
    if (typeof config.rejectUnauthorized !== "boolean") errors.push("SMTP rejectUnauthorized must be boolean");
    if (!Number.isInteger(config.connectionTimeoutMs) || Number(config.connectionTimeoutMs) < 100 || Number(config.connectionTimeoutMs) > 60_000) errors.push("SMTP connectionTimeoutMs must be an integer from 100 to 60000");
    if (!Number.isInteger(config.socketTimeoutMs) || Number(config.socketTimeoutMs) < 1_000 || Number(config.socketTimeoutMs) > 300_000) errors.push("SMTP socketTimeoutMs must be an integer from 1000 to 300000");
    if (typeof config.defaultFromAddress !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.defaultFromAddress)) errors.push("SMTP defaultFromAddress is invalid");
    if (typeof config.defaultFromName !== "string" || !config.defaultFromName.trim() || config.defaultFromName.length > 160) errors.push("SMTP defaultFromName is required");
  }
  return errors;
};

export function validateConnectionProfileInput(input: unknown): ConnectionProfileValidationResult {
  const value = object(input);
  if (!value) return { valid: false, errors: ["Connection Profile must be an object"] };
  const profileKey = typeof value.profileKey === "string" ? value.profileKey.trim().toLowerCase() : "";
  const profileName = typeof value.profileName === "string" ? value.profileName.trim() : "";
  const profileType = value.profileType as ConnectionProfileType;
  const config = object(value.config);
  const secretRefs = object(value.secretRefs);
  const policyInput = object(value.policy);
  const errors: string[] = [];

  if (!PROFILE_KEY.test(profileKey) || profileKey.length > 120) errors.push("profileKey is invalid");
  if (!profileName || profileName.length > 255) errors.push("profileName is invalid");
  if (!CONNECTION_PROFILE_TYPES.includes(profileType)) errors.push("profileType is invalid");
  if (!config) errors.push("config must be an object");
  if (!secretRefs) errors.push("secretRefs must be an object");
  if (!policyInput) errors.push("policy must be an object");
  if (config) {
    for (const path of sensitivePaths(config)) errors.push(`Sensitive value '${path}' must use secretRefs`);
  }

  const allowedModuleKeys = Array.isArray(policyInput?.allowedModuleKeys)
    ? policyInput.allowedModuleKeys.filter((item): item is string => typeof item === "string")
    : [];
  if (
    !Array.isArray(policyInput?.allowedModuleKeys) ||
    allowedModuleKeys.length > 50 ||
    allowedModuleKeys.some((key) => !MODULE_KEY.test(key))
  ) errors.push("policy.allowedModuleKeys is invalid");
  if (typeof policyInput?.allowRuntimeWrite !== "boolean") errors.push("policy.allowRuntimeWrite must be boolean");

  if (CONNECTION_PROFILE_TYPES.includes(profileType) && config && secretRefs) {
    errors.push(...validateTypeConfig(profileType, config));
    const allowed = allowedSecretKeys[profileType];
    const unexpected = Object.keys(secretRefs).filter((key) => !allowed.includes(key)).sort();
    if (unexpected.length) errors.push(`Unsupported secret references: ${unexpected.join(", ")}`);
    for (const key of requiredSecretKeys[profileType]) {
      if (typeof secretRefs[key] !== "string" || !secretRefs[key]) errors.push(`Secret reference '${key}' is required`);
    }
    if (profileType === "SMTP" && config.authMode === "basic") {
      for (const key of ["username", "password"]) {
        if (typeof secretRefs[key] !== "string" || !secretRefs[key]) errors.push(`Secret reference '${key}' is required`);
      }
    }
    for (const [key, reference] of Object.entries(secretRefs)) {
      if (typeof reference !== "string" || !SECRET_REFERENCE.test(reference)) errors.push(`Secret reference '${key}' has an unsupported format`);
    }
  }

  if (errors.length || !config || !secretRefs || !policyInput || !CONNECTION_PROFILE_TYPES.includes(profileType)) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    errors: [],
    value: {
      profileKey,
      profileName,
      profileType,
      config,
      secretRefs: Object.fromEntries(Object.entries(secretRefs).map(([key, reference]) => [key, String(reference)])),
      policy: {
        allowedModuleKeys: [...new Set(allowedModuleKeys)].sort(),
        allowRuntimeWrite: policyInput.allowRuntimeWrite as boolean,
      },
    },
  };
}

export function toPublicConnectionProfile(
  row: ConnectionProfileRow,
  referenceStatus: (reference: string) => { configured: boolean; provider: string },
): PublicConnectionProfile {
  return {
    id: row.id,
    customerId: row.customer_id,
    profileKey: row.profile_key,
    profileName: row.profile_name,
    profileType: row.profile_type,
    config: row.config,
    policy: row.policy,
    status: row.status,
    editVersion: Number(row.edit_version),
    secretReferences: Object.entries(row.secret_refs).sort(([left], [right]) => left.localeCompare(right)).map(([key, reference]) => ({
      key,
      ...referenceStatus(reference),
    })),
    lastCheckedAt: row.last_checked_at?.toISOString() ?? null,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
