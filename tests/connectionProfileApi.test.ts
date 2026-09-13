import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireApiSession: vi.fn(),
  requireCustomerAccess: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.query }),
}));
vi.mock("@/lib/auth/apiAuth", () => ({
  requireApiSession: mocks.requireApiSession,
  requireCustomerAccess: mocks.requireCustomerAccess,
}));
vi.mock("@/lib/services/secrets", () => ({
  secretReferenceStatus: () => ({ configured: true, provider: "environment" }),
}));

import {
  GET as listProfiles,
  POST as createProfile,
} from "@/app/api/connection-profiles/route";
import {
  GET as getProfile,
  PATCH as patchProfile,
} from "@/app/api/connection-profiles/[id]/route";

const actor = {
  sub: "user-a",
  role: "TENANT_USER",
  actor: "user-a",
  mustChangePassword: false,
};
const now = new Date("2026-09-13T00:00:00.000Z");
const row = {
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

const requestBody = () => ({
  customerId: "customer-a",
  profileKey: "main.reporting",
  profileName: "Reporting database",
  profileType: "POSTGRES",
  config: { ...row.config },
  secretRefs: { ...row.secret_refs },
  policy: { ...row.policy, allowedModuleKeys: [...row.policy.allowedModuleKeys] },
});

describe("Connection Profile API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue(actor);
    mocks.requireCustomerAccess.mockResolvedValue(null);
  });

  it("lists only the requested Customer profiles without returning SecretRefs", async () => {
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [row] });

    const response = await listProfiles(new Request("http://local/api/connection-profiles?customerId=customer-a"));

    expect(response.status).toBe(200);
    expect(mocks.requireCustomerAccess).toHaveBeenCalledWith(actor, "customer-a", "VIEWER");
    expect(mocks.query.mock.calls[0][1]).toEqual(["customer-a"]);
    const body = await response.json();
    expect(body.profiles[0].secretReferences).toEqual([
      { key: "password", configured: true, provider: "environment" },
      { key: "username", configured: true, provider: "environment" },
    ]);
    expect(JSON.stringify(body)).not.toContain("LOWCODE_CONNECTION_REPORTING_DB_PASSWORD");
  });

  it("creates a validated profile after Customer EDITOR authorization", async () => {
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [row] });

    const response = await createProfile(new Request("http://local/api/connection-profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody()),
    }));

    expect(response.status).toBe(201);
    expect(mocks.requireCustomerAccess).toHaveBeenCalledWith(actor, "customer-a", "EDITOR");
    expect(mocks.query.mock.calls[0][0]).toContain("INSERT INTO public.connection_profiles");
    expect(JSON.stringify(await response.json())).not.toContain("env://");
  });

  it("rejects plaintext credentials before writing to the database", async () => {
    const input = requestBody();
    Object.assign(input.config, { password: "plaintext" });

    const response = await createProfile(new Request("http://local/api/connection-profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      valid: false,
      errors: expect.arrayContaining([expect.stringContaining("config.password")]),
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("checks ownership from the stored Customer before returning one profile", async () => {
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [row] });
    mocks.requireCustomerAccess.mockResolvedValue(
      NextResponse.json({ error: "denied" }, { status: 403 }),
    );

    const response = await getProfile(new Request("http://local"), {
      params: Promise.resolve({ id: "profile-a" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.requireCustomerAccess).toHaveBeenCalledWith(actor, "customer-a", "VIEWER");
  });

  it("uses optimistic editing and preserves omitted SecretRefs", async () => {
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [row] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const response = await patchProfile(new Request("http://local", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedEditVersion: 1, profileName: "Reporting v2" }),
    }), { params: Promise.resolve({ id: "profile-a" }) });

    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(409);
    expect(body).toMatchObject({ code: "EDIT_CONFLICT" });
    expect(mocks.query.mock.calls[1][0]).toContain("edit_version = $2");
    expect(String(mocks.query.mock.calls[1][1][5])).toContain("LOWCODE_CONNECTION_REPORTING_DB_PASSWORD");
  });
});
