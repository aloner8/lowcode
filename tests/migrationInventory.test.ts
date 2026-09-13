import { describe, expect, it, vi } from "vitest";
import { createMigrationInventory, INVENTORY_SOURCES, REFERENCE_CHECKS } from "../scripts/migration-inventory.mjs";

const mockClient = (missing: string[] = []) => {
  const query = vi.fn(async (sql: string, params?: string[]) => {
    for (const table of missing) {
      if (new RegExp(`public\\.${table}\\b`).test(sql)) throw new Error(`Query used missing table: ${table}`);
    }
    if (sql.startsWith("BEGIN") || sql === "COMMIT" || sql === "ROLLBACK") return { rowCount: 0, rows: [] };
    if (sql.includes("current_database()")) return { rowCount: 1, rows: [{ database_name: "core_copy", server_version: "17.6" }] };
    if (sql.includes("to_regclass")) return { rowCount: 1, rows: [{ present: !missing.includes(params?.[0]?.replace("public.", "") ?? "") }] };
    if (sql.includes("AS row_count")) return { rowCount: 1, rows: [{ row_count: "2", checksum: "a".repeat(32) }] };
    if (sql.includes("AS mapped_count")) return { rowCount: 1, rows: [{ mapped_count: "1" }] };
    if (sql.includes("AS violation_count")) return { rowCount: 1, rows: [{ violation_count: "0" }] };
    if (sql.includes("tenant_db_name")) return { rowCount: 1, rows: [{ app_id: "app-a", app_slug: "agency", tenant_db_name: "app_db_agency" }] };
    throw new Error(`Unexpected query: ${sql}`);
  });
  return { query };
};

describe("P7 migration inventory dry-run", () => {
  it("uses a repeatable read-only snapshot and reports unresolved mappings", async () => {
    const client = mockClient();
    const report = await createMigrationInventory(client, new Date("2026-09-13T12:00:00.000Z"));
    expect(report).toEqual(expect.objectContaining({
      schemaVersion: "p7-migration-inventory.v1", mode: "dry-run", readOnly: true,
      summary: { sourceRows: INVENTORY_SOURCES.length * 2, unresolvedMappings: INVENTORY_SOURCES.length, referenceViolations: 0, readyForApply: false },
      assets: expect.objectContaining({ status: "PER_TENANT_SCAN_REQUIRED" }),
    }));
    expect(client.query.mock.calls[0][0]).toContain("READ ONLY");
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });

  it.each([true, false])("never approves apply for an empty inventory (tables present: %s)", async (present) => {
    const client = mockClient();
    const original = client.query.getMockImplementation()!;
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("to_regclass")) return { rowCount: 1, rows: [{ present }] };
      if (sql.includes("AS row_count")) return { rowCount: 1, rows: [{ row_count: "0", checksum: "a".repeat(32) }] };
      if (sql.includes("AS mapped_count")) return { rowCount: 1, rows: [{ mapped_count: "0" }] };
      if (sql.includes("SELECT id AS app_id")) return { rowCount: 0, rows: [] };
      return original(sql);
    });
    const report = await createMigrationInventory(client);
    expect(report.summary).toMatchObject({ sourceRows: 0, unresolvedMappings: present ? 0 : null, referenceViolations: present ? 0 : null, readyForApply: false });
    expect(report.assets.status).toBe("UNAVAILABLE");
  });

  it("reports missing mapping dependencies without querying them or losing source counts", async () => {
    const client = mockClient(["templates", "customer_memberships"]);
    const report = await createMigrationInventory(client);
    expect(report.sources.find((source) => source.key === "accounts")).toMatchObject({ status: "AVAILABLE", count: 2, mapped: null, unresolved: null, mappingStatus: "UNAVAILABLE", missingDependencies: ["customer_memberships"] });
    expect(report.sources.find((source) => source.key === "pages")).toMatchObject({ mappingStatus: "UNAVAILABLE", missingDependencies: ["templates"] });
    expect(report.summary.unresolvedMappings).toBeNull();
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it.each(["apps", "platform_pages", "platform_pages_components"])("skips dependent checks when %s is absent", async (table) => {
    const client = mockClient([table]);
    const report = await createMigrationInventory(client);
    for (const check of REFERENCE_CHECKS.filter((check) => check.dependencies.includes(table))) {
      expect(report.references.find((row) => row.key === check.key)).toMatchObject({ status: "UNAVAILABLE", violations: null, missingDependencies: [table] });
    }
    expect(report.summary.referenceViolations).toBeNull();
    if (table === "apps") expect(report.assets).toMatchObject({ status: "UNAVAILABLE", tenantDatabases: [], missingDependencies: ["apps"] });
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("commits an all-missing report without any data query", async () => {
    const missing = [...new Set([
      ...INVENTORY_SOURCES.map((source) => source.table),
      ...INVENTORY_SOURCES.flatMap((source) => source.mappingDependencies ?? []),
      ...REFERENCE_CHECKS.flatMap((check) => check.dependencies),
    ])];
    const client = mockClient(missing);
    const report = await createMigrationInventory(client);
    expect(report.sources.every((row) => row.status === "MISSING")).toBe(true);
    expect(report.references.every((row) => row.status === "UNAVAILABLE" && row.violations === null)).toBe(true);
    expect(report.summary).toMatchObject({ unresolvedMappings: null, referenceViolations: null, readyForApply: false });
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("keeps all inventory and reference statements read-only and excludes secret payloads", () => {
    for (const source of INVENTORY_SOURCES) {
      expect(source.mapping.trim()).toMatch(/^SELECT/i);
      expect(source.fingerprint).not.toMatch(/password_hash|secret_refs|config/i);
    }
    for (const check of REFERENCE_CHECKS) expect(check.sql.trim()).toMatch(/^SELECT/i);
  });

  it("rolls back the snapshot if inspection fails", async () => {
    const client = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("metadata unavailable"))
      .mockResolvedValueOnce({ rows: [] }) };
    await expect(createMigrationInventory(client)).rejects.toThrow("metadata unavailable");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });
});
