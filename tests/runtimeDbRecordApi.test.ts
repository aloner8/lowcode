import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getAppTenantRecord: vi.fn(),
  updateAppTenantRecord: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.query }),
}));
vi.mock("@/lib/db/tenantRecords", () => ({
  getAppTenantRecord: mocks.getAppTenantRecord,
  updateAppTenantRecord: mocks.updateAppTenantRecord,
  TenantRecordError: class extends Error {
    status = 400;
  },
}));
vi.mock("@/lib/security/rateLimit", () => ({
  clientIdentity: () => "test-client",
  enforceRateLimit: async () => null,
}));

import { GET, PATCH } from "@/app/api/runtime/[slug]/db/[collectionId]/[recordId]/route";

const definition = (): TemplateDefinition => {
  const value = structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;
  value.template.status = "published";
  value.template.revision = "f".repeat(64);
  return value;
};

const context = {
  params: Promise.resolve({
    slug: "app-a",
    collectionId: "collection.contacts",
    recordId: "7",
  }),
};

describe("runtime api/db record", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ app_id: "app-a", compiled_definition: definition() }],
    });
  });

  it("reads through the server-resolved App DB and Collection table", async () => {
    mocks.getAppTenantRecord.mockResolvedValue({ id: 7, name: "Original" });
    const response = await GET(new Request("http://local"), context);

    expect(response.status).toBe(200);
    expect(mocks.getAppTenantRecord).toHaveBeenCalledWith("app-a", "contacts", "7");
  });

  it("updates through the server-resolved App DB and Collection table", async () => {
    mocks.updateAppTenantRecord.mockResolvedValue({ id: 7, name: "Updated" });
    const response = await PATCH(
      new Request("http://local", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.updateAppTenantRecord).toHaveBeenCalledWith(
      "app-a",
      "contacts",
      "7",
      { name: "Updated" },
    );
  });

  it("does not pass an unknown Collection ID into the tenant DB layer", async () => {
    const response = await PATCH(new Request("http://local", { method: "PATCH", body: "{}" }), {
      params: Promise.resolve({ slug: "app-a", collectionId: "contacts", recordId: "7" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.updateAppTenantRecord).not.toHaveBeenCalled();
  });
});
