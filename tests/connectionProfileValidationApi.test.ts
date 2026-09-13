import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireApiSession: vi.fn(),
  requireCustomerAccess: vi.fn(),
  configured: true,
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.query }),
}));
vi.mock("@/lib/auth/apiAuth", () => ({
  requireApiSession: mocks.requireApiSession,
  requireCustomerAccess: mocks.requireCustomerAccess,
}));
vi.mock("@/lib/services/secrets", () => ({
  secretReferenceStatus: () => ({ configured: mocks.configured, provider: "environment" }),
}));

import { POST } from "@/app/api/connection-profiles/[id]/validate/route";

const actor = {
  sub: "user-a",
  role: "TENANT_USER",
  actor: "user-a",
  mustChangePassword: false,
};
const now = new Date("2026-09-13T00:00:00.000Z");
const profile = (status = "DRAFT") => ({
  id: "profile-a",
  customer_id: "customer-a",
  profile_key: "main.reporting",
  profile_name: "Reporting database",
  profile_type: "POSTGRES",
  config: { host: "db.internal", port: 5432, database: "reporting", sslMode: "require", poolMax: 8 },
  secret_refs: {
    username: "env://LOWCODE_CONNECTION_REPORTING_DB_USER",
    password: "env://LOWCODE_CONNECTION_REPORTING_DB_PASSWORD",
  },
  policy: { allowedModuleKeys: ["reports"], allowRuntimeWrite: false },
  status,
  edit_version: "1",
  last_checked_at: now,
  last_error_code: status === "ERROR" ? "SECRET_REFERENCE_UNAVAILABLE" : null,
  created_at: now,
  updated_at: now,
});

describe("Connection Profile config validation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured = true;
    mocks.requireApiSession.mockResolvedValue(actor);
    mocks.requireCustomerAccess.mockResolvedValue(null);
  });

  it("marks a valid profile READY without returning SecretRefs", async () => {
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [profile()] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [profile("READY")] });

    const response = await POST(new Request("http://local", { method: "POST" }), {
      params: Promise.resolve({ id: "profile-a" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.requireCustomerAccess).toHaveBeenCalledWith(actor, "customer-a", "EDITOR");
    expect(mocks.query.mock.calls[1][1].slice(0, 3)).toEqual([
      "profile-a",
      "READY",
      null,
    ]);
    const body = await response.json();
    expect(body).toMatchObject({ valid: true, errors: [], profile: { status: "READY" } });
    expect(JSON.stringify(body)).not.toContain("env://");
  });

  it("records a stable error code when SecretRefs are unavailable", async () => {
    mocks.configured = false;
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [profile()] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [profile("ERROR")] });

    const response = await POST(new Request("http://local", { method: "POST" }), {
      params: Promise.resolve({ id: "profile-a" }),
    });

    expect(response.status).toBe(422);
    expect(mocks.query.mock.calls[1][1][2]).toBe("SECRET_REFERENCE_UNAVAILABLE");
    const body = await response.json();
    expect(body.valid).toBe(false);
    expect(body.errors).toEqual(expect.arrayContaining([
      "Secret reference 'password' is not configured",
      "Secret reference 'username' is not configured",
    ]));
    expect(JSON.stringify(body)).not.toContain("LOWCODE_CONNECTION_REPORTING_DB_PASSWORD");
  });
});
