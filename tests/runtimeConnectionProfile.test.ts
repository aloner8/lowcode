import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.query }),
}));

import { resolveRuntimeConnectionProfile } from "@/lib/connections/runtimeConnectionProfile";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "profile-a",
  profile_key: "main.reporting",
  profile_type: "POSTGRES",
  config: { host: "db.internal" },
  secret_refs: { password: "env://LOWCODE_CONNECTION_REPORTING_DB_PASSWORD" },
  policy: { allowedModuleKeys: ["reports"], allowRuntimeWrite: false },
  status: "READY",
  ...overrides,
});

describe("runtime Connection Profile policy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves SecretRefs server-side for an allowed read", async () => {
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [row()] });

    await expect(resolveRuntimeConnectionProfile({
      appId: "app-a",
      moduleKey: "reports",
      write: false,
    })).resolves.toMatchObject({
      id: "profile-a",
      secretRefs: { password: "env://LOWCODE_CONNECTION_REPORTING_DB_PASSWORD" },
    });
    expect(mocks.query.mock.calls[0][0]).toContain("profile.customer_id = template.customer_id");
    expect(mocks.query.mock.calls[0][1]).toEqual(["app-a"]);
  });

  it("fails closed when a profile is absent or not READY", async () => {
    mocks.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(resolveRuntimeConnectionProfile({ appId: "app-a", moduleKey: "reports", write: false }))
      .rejects.toMatchObject({ code: "CONNECTION_PROFILE_NOT_CONFIGURED" });

    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [row({ status: "DRAFT" })] });
    await expect(resolveRuntimeConnectionProfile({ appId: "app-a", moduleKey: "reports", write: false }))
      .rejects.toMatchObject({ code: "CONNECTION_PROFILE_NOT_READY" });
  });

  it("enforces module allow-list and read-only policy", async () => {
    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [row()] });
    await expect(resolveRuntimeConnectionProfile({ appId: "app-a", moduleKey: "admin", write: false }))
      .rejects.toMatchObject({ code: "CONNECTION_MODULE_DENIED" });

    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [row()] });
    await expect(resolveRuntimeConnectionProfile({ appId: "app-a", moduleKey: "reports", write: true }))
      .rejects.toMatchObject({ code: "CONNECTION_WRITE_DENIED" });
  });
});
