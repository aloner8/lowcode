import "server-only";
import type {
  ConnectionProfilePolicy,
  ConnectionProfileType,
} from "./connectionProfiles";
import { getCoreDb } from "@/lib/db/coreDb";

interface RuntimeConnectionRow {
  id: string;
  profile_key: string;
  profile_type: ConnectionProfileType;
  config: Record<string, unknown>;
  secret_refs: Record<string, string>;
  policy: ConnectionProfilePolicy;
  status: string;
}

export interface ResolvedRuntimeConnectionProfile {
  id: string;
  profileKey: string;
  profileType: ConnectionProfileType;
  config: Record<string, unknown>;
  secretRefs: Record<string, string>;
}

export class RuntimeConnectionProfileError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "RuntimeConnectionProfileError";
  }
}

/**
 * Server-only connection selector. It returns SecretRefs, never secret values,
 * and applies Customer ownership, readiness, module and write policy in SQL/
 * service code before a connector can perform any I/O.
 */
export async function resolveRuntimeConnectionProfile(input: {
  appId: string;
  moduleKey: string;
  write: boolean;
}): Promise<ResolvedRuntimeConnectionProfile> {
  const result = await getCoreDb().query<RuntimeConnectionRow>(
    `SELECT profile.id, profile.profile_key, profile.profile_type,
            profile.config, profile.secret_refs, profile.policy, profile.status
     FROM public.apps app
     JOIN public.templates template ON template.id = app.template_id
     JOIN public.connection_profiles profile
       ON profile.id = app.connection_profile_id
      AND profile.customer_id = template.customer_id
      AND profile.archived_at IS NULL
     WHERE app.id = $1`,
    [input.appId],
  );
  if (!result.rowCount) {
    throw new RuntimeConnectionProfileError(
      "CONNECTION_PROFILE_NOT_CONFIGURED",
      "App ไม่มี Connection Profile ที่ใช้งานได้",
    );
  }
  const row = result.rows[0];
  if (row.status !== "READY") {
    throw new RuntimeConnectionProfileError(
      "CONNECTION_PROFILE_NOT_READY",
      `Connection Profile '${row.profile_key}' ยังไม่พร้อมใช้งาน`,
    );
  }
  const allowedModules = Array.isArray(row.policy?.allowedModuleKeys)
    ? row.policy.allowedModuleKeys
    : [];
  if (!allowedModules.includes(input.moduleKey)) {
    throw new RuntimeConnectionProfileError(
      "CONNECTION_MODULE_DENIED",
      `Module '${input.moduleKey}' ไม่ได้รับอนุญาตให้ใช้ Connection Profile นี้`,
    );
  }
  if (input.write && row.policy.allowRuntimeWrite !== true) {
    throw new RuntimeConnectionProfileError(
      "CONNECTION_WRITE_DENIED",
      `Connection Profile '${row.profile_key}' อนุญาตเฉพาะการอ่าน`,
    );
  }
  return {
    id: row.id,
    profileKey: row.profile_key,
    profileType: row.profile_type,
    config: row.config,
    secretRefs: row.secret_refs,
  };
}
