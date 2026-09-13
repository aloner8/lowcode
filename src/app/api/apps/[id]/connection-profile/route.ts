import { NextResponse } from "next/server";
import { requireApiSession, requireSiteAccess } from "@/lib/auth/apiAuth";
import {
  toPublicConnectionProfile,
  type ConnectionProfileRow,
} from "@/lib/connections/connectionProfiles";
import { getCoreDb } from "@/lib/db/coreDb";
import { secretReferenceStatus } from "@/lib/services/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AppConnectionRow {
  id: string;
  customer_id: string | null;
  connection_profile_id: string | null;
}

const profileColumns = `
  id, customer_id, profile_key, profile_name, profile_type,
  config, secret_refs, policy, status, edit_version,
  last_checked_at, last_error_code, created_at, updated_at
`;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: appId } = await context.params;
  const denied = await requireSiteAccess(auth, appId, "VIEWER");
  if (denied) return denied;

  const app = await getCoreDb().query<AppConnectionRow>(
    `SELECT app.id, template.customer_id, app.connection_profile_id
     FROM public.apps app
     LEFT JOIN public.templates template ON template.id = app.template_id
     WHERE app.id = $1`,
    [appId],
  );
  if (!app.rowCount) return NextResponse.json({ error: "ไม่พบ App" }, { status: 404 });
  const profileId = app.rows[0].connection_profile_id;
  if (!profileId) return NextResponse.json({ connectionProfile: null });
  const profile = await getCoreDb().query<ConnectionProfileRow>(
    `SELECT ${profileColumns}
     FROM public.connection_profiles
     WHERE id = $1 AND customer_id = $2 AND archived_at IS NULL`,
    [profileId, app.rows[0].customer_id],
  );
  return NextResponse.json({
    connectionProfile: profile.rowCount
      ? toPublicConnectionProfile(profile.rows[0], secretReferenceStatus)
      : null,
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: appId } = await context.params;
  const denied = await requireSiteAccess(auth, appId, "ADMIN");
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "ข้อมูล Connection Profile ไม่ถูกต้อง" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (!("profileId" in input) || !("expectedConnectionProfileId" in input)) {
    return NextResponse.json({ error: "ต้องระบุ profileId และ expectedConnectionProfileId" }, { status: 400 });
  }
  const profileId = input.profileId === null
    ? null
    : typeof input.profileId === "string" && input.profileId.trim()
      ? input.profileId.trim()
      : undefined;
  const expectedProfileId = input.expectedConnectionProfileId === null
    ? null
    : typeof input.expectedConnectionProfileId === "string" && input.expectedConnectionProfileId.trim()
      ? input.expectedConnectionProfileId.trim()
      : undefined;
  if (profileId === undefined || expectedProfileId === undefined) {
    return NextResponse.json({ error: "Connection Profile ID ไม่ถูกต้อง" }, { status: 400 });
  }

  const client = await getCoreDb().connect();
  try {
    await client.query("BEGIN");
    const app = await client.query<AppConnectionRow>(
      `SELECT app.id, template.customer_id, app.connection_profile_id
       FROM public.apps app
       LEFT JOIN public.templates template ON template.id = app.template_id
       WHERE app.id = $1
       FOR UPDATE OF app`,
      [appId],
    );
    if (!app.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ไม่พบ App" }, { status: 404 });
    }
    const current = app.rows[0];
    if (!current.customer_id) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "App นี้ไม่ได้จัดการโดย Customer Template" }, { status: 409 });
    }
    if (current.connection_profile_id !== expectedProfileId) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Connection ของ App ถูกเปลี่ยนจากที่อื่นแล้ว กรุณาโหลดใหม่", code: "EDIT_CONFLICT" },
        { status: 409 },
      );
    }

    let profile: ConnectionProfileRow | null = null;
    if (profileId) {
      const selected = await client.query<ConnectionProfileRow>(
        `SELECT ${profileColumns}
         FROM public.connection_profiles
         WHERE id = $1 AND customer_id = $2 AND archived_at IS NULL`,
        [profileId, current.customer_id],
      );
      if (!selected.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Connection Profile ไม่อยู่ใน Customer เดียวกับ App" },
          { status: 400 },
        );
      }
      profile = selected.rows[0];
      if (profile.status === "DISABLED") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Connection Profile ถูกปิดใช้งาน" }, { status: 409 });
      }
    }

    await client.query(
      `UPDATE public.apps SET connection_profile_id = $2 WHERE id = $1`,
      [appId, profileId],
    );
    await client.query("COMMIT");
    return NextResponse.json({
      connectionProfile: profile
        ? toPublicConnectionProfile(profile, secretReferenceStatus)
        : null,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Unable to bind App Connection Profile", error);
    return NextResponse.json({ error: "ไม่สามารถตั้ง Connection ของ App ได้" }, { status: 500 });
  } finally {
    client.release();
  }
}
