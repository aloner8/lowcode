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

const selectProfiles = `
  SELECT id, customer_id, profile_key, profile_name, profile_type,
         config, secret_refs, policy, status, edit_version,
         last_checked_at, last_error_code, created_at, updated_at
  FROM public.connection_profiles
`;

const publicProfile = (row: ConnectionProfileRow) =>
  toPublicConnectionProfile(row, secretReferenceStatus);

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const customerId = new URL(request.url).searchParams.get("customerId")?.trim() ?? "";
  if (!customerId) {
    return NextResponse.json({ error: "ต้องระบุ customerId" }, { status: 400 });
  }
  const denied = await requireCustomerAccess(auth, customerId, "VIEWER");
  if (denied) return denied;

  try {
    const result = await getCoreDb().query<ConnectionProfileRow>(
      `${selectProfiles}
       WHERE customer_id = $1 AND archived_at IS NULL
       ORDER BY updated_at DESC, id`,
      [customerId],
    );
    return NextResponse.json({ profiles: result.rows.map(publicProfile) });
  } catch (error) {
    console.error("Unable to list Connection Profiles", error);
    return NextResponse.json({ error: "ไม่สามารถอ่าน Connection Profile ได้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "ข้อมูล Connection Profile ไม่ถูกต้อง" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const customerId = typeof input.customerId === "string" ? input.customerId.trim() : "";
  if (!customerId) {
    return NextResponse.json({ error: "ต้องระบุ customerId" }, { status: 400 });
  }
  const denied = await requireCustomerAccess(auth, customerId, "EDITOR");
  if (denied) return denied;

  const checked = validateConnectionProfileInput(input);
  if (!checked.valid || !checked.value) {
    return NextResponse.json({ valid: false, errors: checked.errors }, { status: 422 });
  }
  const profile = checked.value;
  try {
    const result = await getCoreDb().query<ConnectionProfileRow>(
      `INSERT INTO public.connection_profiles (
         customer_id, profile_key, profile_name, profile_type,
         config, secret_refs, policy, status, created_by, updated_by
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, 'DRAFT', $8, $8)
       RETURNING id, customer_id, profile_key, profile_name, profile_type,
                 config, secret_refs, policy, status, edit_version,
                 last_checked_at, last_error_code, created_at, updated_at`,
      [
        customerId,
        profile.profileKey,
        profile.profileName,
        profile.profileType,
        JSON.stringify(profile.config),
        JSON.stringify(profile.secretRefs),
        JSON.stringify(profile.policy),
        auth.sub,
      ],
    );
    return NextResponse.json({ profile: publicProfile(result.rows[0]) }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "profileKey นี้มีอยู่แล้ว" }, { status: 409 });
    }
    console.error("Unable to create Connection Profile", error);
    return NextResponse.json({ error: "ไม่สามารถสร้าง Connection Profile ได้" }, { status: 500 });
  }
}
