import type { StudioServiceDefinition } from "@/types";
import { normalizeServiceBinding } from "./bindings";

export interface AppBindingOverridePolicyResult {
  valid: boolean;
  errors: string[];
  binding: StudioServiceDefinition;
}

const list = (values: unknown) => Array.isArray(values)
  ? values.filter((value): value is string => typeof value === "string")
  : [];

const sortedUnique = (values: string[]) => [...new Set(values)].sort();

const missingFrom = (requested: string[], allowed: string[]) => {
  const allowedSet = new Set(allowed);
  return sortedUnique(requested).filter((value) => !allowedSet.has(value));
};

/**
 * App overrides may narrow or supply app-owned config/secret values, but they
 * cannot change the service contract or expand the platform-published policy.
 */
export function validateAppBindingOverridePolicy(
  platformBindingsInput: unknown,
  overrideInput: StudioServiceDefinition,
): AppBindingOverridePolicyResult {
  const binding = normalizeServiceBinding(overrideInput);
  const platformBindings = Array.isArray(platformBindingsInput)
    ? platformBindingsInput.map((entry) => normalizeServiceBinding(entry as StudioServiceDefinition))
    : [];
  const parent = platformBindings.find((entry) => entry.id === binding.id);
  const errors: string[] = [];

  if (!parent) {
    errors.push(`App override '${binding.id}' must reference a platform-published connection`);
    return { valid: false, errors, binding };
  }

  if (parent.serviceRef?.serviceKey !== binding.serviceRef?.serviceKey) {
    errors.push(`App override '${binding.id}' cannot change serviceKey`);
  }
  if (parent.serviceRef?.version !== binding.serviceRef?.version) {
    errors.push(`App override '${binding.id}' cannot change service version`);
  }
  if (!parent.enabled && binding.enabled) {
    errors.push(`App override '${binding.id}' cannot enable a disabled platform connection`);
  }

  const requestedOperations = list(binding.policy?.allowedOperations);
  const platformOperations = list(parent.policy?.allowedOperations);
  const extraOperations = missingFrom(requestedOperations, platformOperations);
  if (extraOperations.length) {
    errors.push(`App override '${binding.id}' cannot add operations: ${extraOperations.join(", ")}`);
  }

  const parentPermissions = parent.policy?.requiredPermissions ?? {};
  const requestedPermissions = binding.policy?.requiredPermissions ?? {};
  for (const [operation, permissions] of Object.entries(requestedPermissions)) {
    if (!requestedOperations.includes(operation)) {
      errors.push(`App override '${binding.id}' has permissions for disabled operation '${operation}'`);
      continue;
    }
    const extraPermissions = missingFrom(permissions, parentPermissions[operation] ?? []);
    if (extraPermissions.length) {
      errors.push(`App override '${binding.id}' cannot add permissions for '${operation}': ${extraPermissions.join(", ")}`);
    }
  }

  const platformRateLimit = parent.policy?.rateLimit;
  const requestedRateLimit = binding.policy?.rateLimit;
  if (platformRateLimit && requestedRateLimit) {
    if (requestedRateLimit.requests > platformRateLimit.requests) {
      errors.push(`App override '${binding.id}' cannot raise rateLimit.requests above ${platformRateLimit.requests}`);
    }
    if (requestedRateLimit.windowSeconds < platformRateLimit.windowSeconds) {
      errors.push(`App override '${binding.id}' cannot shorten rateLimit.windowSeconds below ${platformRateLimit.windowSeconds}`);
    }
  }

  return { valid: errors.length === 0, errors, binding };
}
