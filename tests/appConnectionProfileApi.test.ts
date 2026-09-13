import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  requireApiSession: vi.fn(),
  requireSiteAccess: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.query, connect: mocks.connect }),
}));
vi.mock("@/lib/auth/apiAuth", () => ({
  requireApiSession: mocks.requireApiSession,
  requireSiteAccess: mocks.requireSiteAccess,
}));
vi.mock("@/lib/services/secrets", () => ({
  secretReferenceStatus: () => ({ configured: true, provider: "environment" }),
}));

import { GET, POST, PUT } from "@/app/api/apps/[id]/connection-profile/route";

const actor = {
  sub: "user-a",
  role: "TENANT_USER",
  actor: "user-a",
  mustChangePassword: false,
};
const now = new Date("2026-09-13T00:00:00.000Z");
const profile = {
  id: "profile-a",
  customer_id: "customer-a",
  profile_key: "main.reporting",
  profile_name: "Reporting database",
  profile_type: "POSTGRES",
  config: { host: "db.internal", port: 5432, database: "reporting", sslMode: "require", poolMax: 8 },
  secret_refs: { username: "env://LOWCODE_CONNECTION_REPORTING_DB_USER", password: "env://LOWCODE_CONNECTION_REPORTING_DB_PASSWORD" },
  policy: { allowedModuleKeys: ["reports"], allowRuntimeWrite: false },
  status: "DRAFT",
  edit_version: "1",
  last_checked_at: null,
  last_error_code: null,
  created_at: now,
  updated_at: now,
};

const request = (profileId: string | null, expectedConnectionProfileId: string | null) =>
  new Request("http://local", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId, expectedConnectionProfileId }),
  });

const createRequest = () =>
  new Request("http://local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profileKey: "main.reporting",
      profileName: "Reporting database",
      profileType: "POSTGRES",
      config: {
        host: "db.internal",
        port: 5432,
        database: "reporting",
        sslMode: "require",
        poolMax: 8,
      },
      secretRefs: {
        username: "env://LOWCODE_CONNECTION_REPORTING_DB_USER",
        password: "env://LOWCODE_CONNECTION_REPORTING_DB_PASSWORD",
      },
      policy: { allowedModuleKeys: ["reports"], allowRuntimeWrite: false },
    }),
  });

describe("App Connection Profile API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue(actor);
    mocks.requireSiteAccess.mockResolvedValue(null);
  });

  it("lists selectable profiles for the App customer without exposing SecretRefs", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "app-a", customer_id: "customer-a", connection_profile_id: "profile-a" }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [profile] });

    const response = await GET(new Request("http://local"), {
      params: Promise.resolve({ id: "app-a" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.requireSiteAccess).toHaveBeenCalledWith(actor, "app-a", "VIEWER");
    expect(mocks.query.mock.calls[1][1]).toEqual(["customer-a"]);
    const body = await response.json();
    expect(body.connectionProfile.id).toBe("profile-a");
    expect(body.profiles).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("LOWCODE_CONNECTION_REPORTING_DB_PASSWORD");
  });

  it("creates a profile for the App customer without requiring customerId from the browser", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "app-a", customer_id: "customer-a", connection_profile_id: null }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [profile] });

    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: "app-a" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.requireSiteAccess).toHaveBeenCalledWith(actor, "app-a", "ADMIN");
    expect(mocks.query.mock.calls[1][0]).toContain("INSERT INTO public.connection_profiles");
    expect(mocks.query.mock.calls[1][1][0]).toBe("customer-a");
    expect(JSON.stringify(await response.json())).not.toContain("env://LOWCODE_CONNECTION_REPORTING_DB_PASSWORD");
  });

  it("rejects App-scoped profile creation when config contains plaintext secrets", async () => {
    mocks.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: "app-a", customer_id: "customer-a", connection_profile_id: null }],
    });
    const input = await createRequest().json() as Record<string, any>;
    input.config.password = "plaintext";

    const response = await POST(new Request("http://local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }), {
      params: Promise.resolve({ id: "app-a" }),
    });

    expect(response.status).toBe(422);
    expect(mocks.query).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      errors: expect.arrayContaining([expect.stringContaining("config.password")]),
    });
  });

  it("binds a profile from the same Customer and does not expose SecretRefs", async () => {
    const client = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes("FROM public.apps app")) {
          return { rowCount: 1, rows: [{ id: "app-a", customer_id: "customer-a", connection_profile_id: null }] };
        }
        if (sql.includes("FROM public.connection_profiles")) {
          return { rowCount: 1, rows: [profile] };
        }
        return { rowCount: 1, rows: [] };
      }),
      release: vi.fn(),
    };
    mocks.connect.mockResolvedValue(client);

    const response = await PUT(request("profile-a", null), {
      params: Promise.resolve({ id: "app-a" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.requireSiteAccess).toHaveBeenCalledWith(actor, "app-a", "ADMIN");
    const update = client.query.mock.calls.find(([sql]) => String(sql).includes("UPDATE public.apps"));
    expect(update?.[1]).toEqual(["app-a", "profile-a"]);
    const body = await response.json();
    expect(body.connectionProfile.id).toBe("profile-a");
    expect(JSON.stringify(body)).not.toContain("LOWCODE_CONNECTION_REPORTING_DB_PASSWORD");
  });

  it("rejects a profile outside the App Customer", async () => {
    const client = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes("FROM public.apps app")) {
          return { rowCount: 1, rows: [{ id: "app-a", customer_id: "customer-a", connection_profile_id: null }] };
        }
        if (sql.includes("FROM public.connection_profiles")) return { rowCount: 0, rows: [] };
        return { rowCount: null, rows: [] };
      }),
      release: vi.fn(),
    };
    mocks.connect.mockResolvedValue(client);

    const response = await PUT(request("profile-b", null), {
      params: Promise.resolve({ id: "app-a" }),
    });

    expect(response.status).toBe(400);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE public.apps"))).toBe(false);
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK");
  });

  it("rejects a stale App selector without looking up the requested profile", async () => {
    const client = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes("FROM public.apps app")) {
          return { rowCount: 1, rows: [{ id: "app-a", customer_id: "customer-a", connection_profile_id: "profile-current" }] };
        }
        return { rowCount: null, rows: [] };
      }),
      release: vi.fn(),
    };
    mocks.connect.mockResolvedValue(client);

    const response = await PUT(request("profile-a", null), {
      params: Promise.resolve({ id: "app-a" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "EDIT_CONFLICT" });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("FROM public.connection_profiles"))).toBe(false);
  });

  it("does not touch the database when Site ADMIN access is denied", async () => {
    mocks.requireSiteAccess.mockResolvedValue(
      NextResponse.json({ error: "denied" }, { status: 403 }),
    );

    const response = await PUT(request("profile-a", null), {
      params: Promise.resolve({ id: "app-a" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
