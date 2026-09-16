import type { JsonValue } from "@/lib/template/contracts";

export type SupportedModuleKey = "auth" | "files" | "google" | "media";

export interface ModuleSettingDefinition {
  key: SupportedModuleKey;
  label: string;
  description: string;
  defaultConfig: Record<string, JsonValue>;
}

export interface ModuleSettingValidationResult {
  valid: boolean;
  issues: Array<{ code: string; path: string; message: string }>;
}

export const MODULE_SETTING_CATALOG: readonly ModuleSettingDefinition[] = [
  {
    key: "auth",
    label: "Auth",
    description: "App-local member login with optional Google, LINE, or Facebook federation.",
    defaultConfig: { providers: ["local"], allowRegister: false, afterLogin: "/" },
  },
  {
    key: "files",
    label: "Local Files",
    description: "Tenant-scoped file storage with a safe default working folder.",
    defaultConfig: { workingPath: "/documents" },
  },
  {
    key: "google",
    label: "Google Workspace",
    description: "Calendar, Drive, Forms, Maps, Vision and AI through a Platform-controlled binding.",
    defaultConfig: { features: ["calendar", "drive", "forms"] },
  },
  {
    key: "media",
    label: "Local Media",
    description: "QR generation and tenant-scoped image processing without external credentials.",
    defaultConfig: { features: ["qr", "image"] },
  },
] as const;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const unexpectedKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).filter((key) => !allowed.includes(key));

export const createDefaultModuleConfig = (moduleKey: SupportedModuleKey) =>
  structuredClone(MODULE_SETTING_CATALOG.find((item) => item.key === moduleKey)!.defaultConfig);

export function validateModuleSetting(
  module: { moduleKey: unknown; enabled: unknown; config: unknown },
): ModuleSettingValidationResult {
  const issues: ModuleSettingValidationResult["issues"] = [];
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
  const definition = MODULE_SETTING_CATALOG.find((item) => item.key === module.moduleKey);
  if (!definition) {
    issue("unsupported_module", "moduleKey", `Module '${module.moduleKey}' is not supported by this runtime image`);
    return { valid: false, issues };
  }
  if (typeof module.enabled !== "boolean") {
    issue("invalid_module_enabled", "enabled", "enabled must be a boolean");
  }
  const config = record(module.config);
  if (!config) {
    issue("invalid_module_config", "config", "config must be an object");
    return { valid: false, issues };
  }

  if (definition.key === "auth") {
    unexpectedKeys(config, ["providers", "allowRegister", "afterLogin"]).forEach((key) =>
      issue("unsupported_module_config", `config.${key}`, `Auth config '${key}' is not supported`),
    );
    const providers = Array.isArray(config.providers) ? config.providers : [];
    const supportedProviders = new Set(["local", "google", "line", "facebook", "ldap", "ad-ds", "entra"]);
    if (!providers.length || providers.some((provider) => typeof provider !== "string" || !supportedProviders.has(provider)) || new Set(providers).size !== providers.length) {
      issue("unsupported_auth_provider", "config.providers", "Auth providers must be a unique supported provider selection");
    }
    if (typeof config.allowRegister !== "boolean") {
      issue("invalid_auth_registration", "config.allowRegister", "allowRegister must be a boolean");
    }
    if (typeof config.afterLogin !== "string" || !/^\/(?!\/)/.test(config.afterLogin) || config.afterLogin.includes("\\")) {
      issue("invalid_after_login", "config.afterLogin", "afterLogin must be a local absolute path");
    }
  } else if (definition.key === "files") {
    unexpectedKeys(config, ["workingPath"]).forEach((key) =>
      issue("unsupported_module_config", `config.${key}`, `Files config '${key}' is not supported`),
    );
    const workingPath = config.workingPath;
    const segments = typeof workingPath === "string" ? workingPath.split("/") : [];
    if (
      typeof workingPath !== "string" ||
      !/^\/(?!\/)/.test(workingPath) ||
      workingPath.includes("\\") ||
      segments.some((segment) => segment === "." || segment === "..")
    ) {
      issue("invalid_files_working_path", "config.workingPath", "workingPath must be a safe tenant-relative absolute path");
    }
  } else {
    unexpectedKeys(config, ["features"]).forEach((key) => issue("unsupported_module_config", `config.${key}`, `${definition.label} config '${key}' is not supported`));
    const allowed = definition.key === "google" ? new Set(["maps", "calendar", "drive", "forms", "vision", "ai"]) : new Set(["qr", "image"]);
    const features = Array.isArray(config.features) ? config.features : [];
    if (!features.length || features.some((feature) => typeof feature !== "string" || !allowed.has(feature)) || new Set(features).size !== features.length) {
      issue("unsupported_module_feature", "config.features", `${definition.label} features must be a non-empty unique supported selection`);
    }
  }
  return { valid: issues.length === 0, issues };
}
