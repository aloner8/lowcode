import { NextResponse } from "next/server";
import { requireApiSession, requireCustomerAccess } from "@/lib/auth/apiAuth";
import {
  toPublicConnectionProfile,
  validateConnectionProfileInput,
  type ConnectionProfileRow,
} from "@/lib/connections/connectionProfiles";
import { getCoreDb } from "@/lib/db/coreDb";
import { secretReferenceStatus } from "@/lib/services/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const loaded = await getCoreDb().query<ConnectionProfileRow>(
    `SELECT id, customer_id, profile_key, profile_name, profile_type,
            config, secret_refs, policy, status, edit_version,
            last_checked_at, last_error_code, created_at, updated_at
     FROM public.connection_profiles
     WHERE id = $1 AND archived_at IS NULL`,
    [id],
  );
  if (!loaded.rowCount) {
    return NextResponse.json({ error: "ไม่พบ Connection Profile" }, { status: 404 });
  }
  const profile = loaded.rows[0];
  const denied = await requireCustomerAccess(auth, profile.customer_id, "EDITOR");
  if (denied) return denied;

  const checked = validateConnectionProfileInput({
    profileKey: profile.profile_key,
    profileName: profile.profile_name,
    profileType: profile.profile_type,
    config: profile.config,
    secretRefs: profile.secret_refs,
    policy: profile.policy,
  });
  const unavailableSecretKeys = Object.entries(profile.secret_refs)
    .filter(([, reference]) => !secretReferenceStatus(reference).configured)
    .map(([key]) => key)
    .sort();
  const errors = [
    ...checked.errors,
    ...unavailableSecretKeys.map((key) => `Secret reference '${key}' is not configured`),
  ];
  const status = errors.length ? "ERROR" : "READY";
  const errorCode = errors.length
    ? unavailableSecretKeys.length
      ? "SECRET_REFERENCE_UNAVAILABLE"
      : "CONFIG_INVALID"
    : null;
  const result = await getCoreDb().query<ConnectionProfileRow>(
    `UPDATE public.connection_profiles
     SET status = $2, last_checked_at = NOW(), last_error_code = $3,
         last_error_detail = $4, updated_by = $5
     WHERE id = $1
     RETURNING id, customer_id, profile_key, profile_name, profile_type,
               config, secret_refs, policy, status, edit_version,
               last_checked_at, last_error_code, created_at, updated_at`,
    [id, status, errorCode, errors.length ? errors.join("; ") : null, auth.sub],
  );
  return NextResponse.json({
    valid: errors.length === 0,
    errors,
    profile: toPublicConnectionProfile(result.rows[0], secretReferenceStatus),
  }, { status: errors.length ? 422 : 200 });
}
