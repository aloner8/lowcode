import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  coreQuery: vi.fn(),
  poolQuery: vi.fn(),
  poolOptions: [] as unknown[],
}));

vi.mock("pg", () => ({
  Pool: class {
    query = mocks.poolQuery;

    constructor(options: unknown) {
      mocks.poolOptions.push(options);
    }
  },
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.coreQuery }),
}));

import {
  getAppTenantDb,
  openTenantDbByName,
  provisionTenantDatabase,
  TenantDatabaseNotProvisionedError,
} from "@/lib/db/tenantDb";

describe("tenant database open/provision split", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.poolOptions.length = 0;
    process.env.CORE_DATABASE_URL = "postgresql://localhost/lowcode_test";
    mocks.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
  });

  it("does not create a missing database on an ordinary open", async () => {
    mocks.coreQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ exists: false }],
    });

    await expect(openTenantDbByName("app_db_missing_read")).rejects.toBeInstanceOf(
      TenantDatabaseNotProvisionedError,
    );
    expect(mocks.coreQuery).toHaveBeenCalledOnce();
    expect(mocks.coreQuery.mock.calls[0][0]).not.toContain("CREATE DATABASE");
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it("creates and bootstraps only through explicit provisioning", async () => {
    mocks.coreQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ exists: false }] })
      .mockResolvedValueOnce({ rowCount: null, rows: [] });

    const result = await provisionTenantDatabase("app_db_explicit_provision");

    expect(result.created).toBe(true);
    expect(mocks.coreQuery.mock.calls[1][0]).toBe(
      'CREATE DATABASE "app_db_explicit_provision"',
    );
    expect(mocks.poolQuery).toHaveBeenCalledTimes(2);
    expect(mocks.poolQuery.mock.calls[1][0]).toContain("sys.structure_revisions");
  });

  it("resolves an App-owned existing DB without provisioning or bootstrapping", async () => {
    mocks.coreQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ tenant_db_name: "app_db_existing_read", app_slug: "existing" }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ exists: true }] });

    const result = await getAppTenantDb("app-existing");

    expect(result.database).toBe("app_db_existing_read");
    expect(result.appSlug).toBe("existing");
    expect(mocks.coreQuery.mock.calls.some(([sql]) =>
      String(sql).includes("CREATE DATABASE"),
    )).toBe(false);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });
});
