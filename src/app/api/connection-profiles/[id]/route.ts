import { NextResponse } from "next/server";
import { requireApiSession, requireCustomerAccess } from "@/lib/auth/apiAuth";
import {
  toPublicConnectionProfile,
  validateConnectionProfileInput,
  type ConnectionProfileRow,
  type ConnectionProfileStatus,
} from "@/lib/connections/connectionProfiles";
import { getCoreDb } from "@/lib/db/coreDb";
import { secretReferenceStatus } from "@/lib/services/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const selectProfile = `
  SELECT id, customer_id, profile_key, profile_name, profile_type,
         config, secret_refs, policy, status, edit_version,
         last_checked_at, last_error_code, created_at, updated_at
  FROM public.connection_profiles
  WHERE id = $1 AND archived_at IS NULL
`;

const loadProfile = async (id: string) => {
  const result = await getCoreDb().query<ConnectionProfileRow>(selectProfile, [id]);
  return result.rows[0] ?? null;
};

const publicProfile = (row: ConnectionProfileRow) =>
  toPublicConnectionProfile(row, secretReferenceStatus);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const profile = await loadProfile(id);
  if (!profile) return NextResponse.json({ error: "ไม่พบ Connection Profile" }, { status: 404 });
  const denied = await requireCustomerAccess(auth, profile.customer_id, "VIEWER");
  if (denied) return denied;
  return NextResponse.json({ profile: publicProfile(profile) });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const existing = await loadProfile(id);
  if (!existing) return NextResponse.json({ error: "ไม่พบ Connection Profile" }, { status: 404 });
  const denied = await requireCustomerAccess(auth, existing.customer_id, "EDITOR");
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "ข้อมูล Connection Profile ไม่ถูกต้อง" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const expectedEditVersion = typeof input.expectedEditVersion === "number"
    ? input.expectedEditVersion
    : -1;
  if (!Number.isInteger(expectedEditVersion) || expectedEditVersion < 1) {
    return NextResponse.json({ error: "expectedEditVersion ไม่ถูกต้อง" }, { status: 400 });
  }
  if (input.profileType !== undefined && input.profileType !== existing.profile_type) {
    return NextResponse.json({ error: "เปลี่ยนชนิด Connection Profile ไม่ได้ ให้สร้าง Profile ใหม่" }, { status: 400 });
  }
  const requestedStatus = input.status as ConnectionProfileStatus | undefined;
  if (requestedStatus !== undefined && !["DRAFT", "DISABLED"].includes(requestedStatus)) {
    return NextResponse.json({ error: "status เปลี่ยนได้เฉพาะ DRAFT หรือ DISABLED" }, { status: 400 });
  }
  const secretPatch = input.secretRefs && typeof input.secretRefs === "object" && !Array.isArray(input.secretRefs)
    ? input.secretRefs as Record<string, unknown>
    : null;
  const mergedSecretRefs = secretPatch
    ? Object.fromEntries(Object.entries({ ...existing.secret_refs, ...secretPatch }).filter(([, value]) => value !== null))
    : existing.secret_refs;
  const checked = validateConnectionProfileInput({
    profileKey: existing.profile_key,
    profileName: typeof input.profileName === "string" ? input.profileName : existing.profile_name,
    profileType: existing.profile_type,
    config: input.config ?? existing.config,
    secretRefs: mergedSecretRefs,
    policy: input.policy ?? existing.policy,
  });
  if (!checked.valid || !checked.value) {
    return NextResponse.json({ valid: false, errors: checked.errors }, { status: 422 });
  }

  const next = checked.value;
  const nextStatus = requestedStatus ?? "DRAFT";
  const result = await getCoreDb().query<ConnectionProfileRow>(
    `UPDATE public.connection_profiles
     SET profile_name = $4, config = $5::jsonb, secret_refs = $6::jsonb,
         policy = $7::jsonb, status = $8, edit_version = edit_version + 1,
         last_checked_at = NULL, last_error_code = NULL, last_error_detail = NULL,
         updated_by = $3
     WHERE id = $1 AND edit_version = $2 AND archived_at IS NULL
     RETURNING id, customer_id, profile_key, profile_name, profile_type,
               config, secret_refs, policy, status, edit_version,
               last_checked_at, last_error_code, created_at, updated_at`,
    [
      id,
      expectedEditVersion,
      auth.sub,
      next.profileName,
      JSON.stringify(next.config),
      JSON.stringify(next.secretRefs),
      JSON.stringify(next.policy),
      nextStatus,
    ],
  );
  if (!result.rowCount) {
    return NextResponse.json(
      { error: "Connection Profile ถูกแก้จากที่อื่นแล้ว กรุณาโหลดใหม่", code: "EDIT_CONFLICT" },
      { status: 409 },
    );
  }
  return NextResponse.json({ profile: publicProfile(result.rows[0]) });
}
