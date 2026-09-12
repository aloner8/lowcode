import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const mocks = vi.hoisted(() => ({
  coreQuery: vi.fn(),
  provisionAppTenantDb: vi.fn(),
  applyAppSchema: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.coreQuery }),
}));
vi.mock("@/lib/db/tenantDb", () => ({
  provisionAppTenantDb: mocks.provisionAppTenantDb,
}));
vi.mock("@/lib/db/appSchema", () => ({
  applyAppSchema: mocks.applyAppSchema,
}));

import { provisionTemplateAppDatabase } from "@/lib/db/templateAppProvisioning";

const definition = (): TemplateDefinition => {
  const value = structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;
  value.template.status = "published";
  value.template.revision = "a".repeat(64);
  return value;
};

const sourceRow = (status: "RUNNING" | "COMPLETED" = "RUNNING") => ({
  app_id: "app-a",
  tenant_db_name: "app_db_a",
  operation_id: "operation-a",
  operation_status: status,
  revision_digest: "a".repeat(64),
  compiled_definition: definition(),
});

describe("resumable Template App database provisioner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a completed operation without repeating external work", async () => {
    mocks.coreQuery.mockResolvedValue({ rowCount: 1, rows: [sourceRow("COMPLETED")] });

    const result = await provisionTemplateAppDatabase("app-a", "operation-a");

    expect(result).toMatchObject({ reused: true, database: "app_db_a" });
    expect(mocks.provisionAppTenantDb).not.toHaveBeenCalled();
    expect(mocks.applyAppSchema).not.toHaveBeenCalled();
  });

  it("advances durable checkpoints around idempotent DB/schema work", async () => {
    mocks.coreQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [sourceRow()] })
      .mockResolvedValue({ rowCount: 1, rows: [] });
    mocks.provisionAppTenantDb.mockResolvedValue({
      pool: { id: "pool-a" },
      database: "app_db_a",
      created: true,
    });
    mocks.applyAppSchema.mockResolvedValue({
      revision: "a".repeat(64),
      tables: ["contacts"],
    });

    const result = await provisionTemplateAppDatabase("app-a", "operation-a");

    expect(result).toMatchObject({
      reused: false,
      database: "app_db_a",
      tables: ["contacts"],
    });
    expect(mocks.provisionAppTenantDb).toHaveBeenCalledWith("app-a");
    expect(mocks.applyAppSchema).toHaveBeenCalledWith(
      { id: "pool-a" },
      expect.objectContaining({ template: expect.objectContaining({ status: "published" }) }),
    );
    expect(mocks.coreQuery.mock.calls.some(([sql]) =>
      String(sql).includes("DATABASE_READY"),
    )).toBe(true);
    expect(mocks.coreQuery.mock.calls.some(([sql]) =>
      String(sql).includes("SCHEMA_READY"),
    )).toBe(true);
  });

  it("marks both App and operation failed while preserving the error", async () => {
    mocks.coreQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [sourceRow()] })
      .mockResolvedValue({ rowCount: 1, rows: [] });
    mocks.provisionAppTenantDb.mockRejectedValue(new Error("database unavailable"));

    await expect(
      provisionTemplateAppDatabase("app-a", "operation-a"),
    ).rejects.toThrow("database unavailable");
    expect(mocks.coreQuery.mock.calls.some(([sql]) =>
      String(sql).includes("observed_state = 'FAILED'"),
    )).toBe(true);
    expect(mocks.coreQuery.mock.calls.some(([sql]) =>
      String(sql).includes("status = 'FAILED'"),
    )).toBe(true);
  });
});
