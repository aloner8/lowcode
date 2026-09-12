import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  listAppTenantRecords: vi.fn(),
  insertAppTenantRecord: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.query }),
}));
vi.mock("@/lib/db/tenantRecords", () => ({
  listAppTenantRecords: mocks.listAppTenantRecords,
  insertAppTenantRecord: mocks.insertAppTenantRecord,
  TenantRecordError: class extends Error {
    status = 400;
  },
}));
vi.mock("@/lib/security/rateLimit", () => ({
  clientIdentity: () => "test-client",
  enforceRateLimit: async () => null,
}));

import { GET, POST } from "@/app/api/runtime/[slug]/db/[collectionId]/route";

const definition = (): TemplateDefinition => {
  const value = structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;
  value.template.status = "published";
  value.template.revision = "f".repeat(64);
  return value;
};

describe("runtime api/db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ app_id: "app-a", compiled_definition: definition() }],
    });
  });

  it("maps Collection ID to the server-owned App DB/table on reads", async () => {
    mocks.listAppTenantRecords.mockResolvedValue({
      table: "contacts",
      columns: ["id", "name"],
      rows: [{ id: 1, name: "A" }],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const response = await GET(
      new Request("http://local/api/runtime/app-a/db/collection.contacts"),
      { params: Promise.resolve({ slug: "app-a", collectionId: "collection.contacts" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.listAppTenantRecords).toHaveBeenCalledWith(
      "app-a",
      "contacts",
      expect.objectContaining({ limit: 20 }),
    );
  });

  it("never treats a caller-controlled Collection ID as a table name", async () => {
    const response = await GET(
      new Request("http://local/api/runtime/app-a/db/arbitrary_table"),
      { params: Promise.resolve({ slug: "app-a", collectionId: "arbitrary_table" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.listAppTenantRecords).not.toHaveBeenCalled();
  });

  it("inserts into the App DB only when the published Collection allows it", async () => {
    mocks.insertAppTenantRecord.mockResolvedValue({ id: 1, name: "Created" });
    const response = await POST(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Created" }),
      }),
      { params: Promise.resolve({ slug: "app-a", collectionId: "collection.contacts" }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.insertAppTenantRecord).toHaveBeenCalledWith(
      "app-a",
      "contacts",
      { name: "Created" },
    );
  });
});
