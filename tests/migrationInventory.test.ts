import { describe, expect, it, vi } from "vitest";
import { createMigrationInventory, INVENTORY_SOURCES, REFERENCE_CHECKS } from "../scripts/migration-inventory.mjs";

const mockClient = () => {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("BEGIN") || sql === "COMMIT" || sql === "ROLLBACK") return { rowCount: 0, rows: [] };
    if (sql.includes("current_database()")) return { rowCount: 1, rows: [{ database_name: "core_copy", server_version: "17.6" }] };
    if (sql.includes("to_regclass")) return { rowCount: 1, rows: [{ present: true }] };
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
    expect(report.summary).toMatchObject({ sourceRows: 0, unresolvedMappings: 0, referenceViolations: 0, readyForApply: false });
    expect(report.assets.status).toBe("UNAVAILABLE");
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
