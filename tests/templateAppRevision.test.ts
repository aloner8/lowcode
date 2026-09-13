import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const mocks = vi.hoisted(() => ({
  coreQuery: vi.fn(),
  coreConnect: vi.fn(),
  openTenantDbByName: vi.fn(),
  applyAppSchema: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.coreQuery, connect: mocks.coreConnect }),
}));
vi.mock("@/lib/db/tenantDb", () => ({
  openTenantDbByName: mocks.openTenantDbByName,
}));
vi.mock("@/lib/db/appSchema", () => ({
  applyAppSchema: mocks.applyAppSchema,
}));

import {
  applyTemplateAppRevisionUpdate,
  registerTemplateAppRevisionUpdate,
} from "@/lib/db/templateAppRevision";

const publishedDefinition = (revision: string): TemplateDefinition => {
  const value = structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;
  value.template.status = "published";
  value.template.revision = revision;
  return value;
};

describe("Template App revision updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a durable UPDATE_REVISION operation without changing the App", async () => {
    const client = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes("FROM public.apps app")) {
          return { rowCount: 1, rows: [{
            app_id: "app-a",
            customer_id: "customer-a",
            template_id: "template-a",
            source_revision_id: "revision-1",
            tenant_db_name: "app_db_a",
          }] };
        }
        if (sql.includes("FROM public.template_revisions")) {
          return { rowCount: 1, rows: [{ id: "revision-2" }] };
        }
        if (sql.includes("WHERE customer_id")) return { rowCount: 0, rows: [] };
        if (sql.includes("status IN ('PENDING', 'RUNNING')")) return { rowCount: 0, rows: [] };
        if (sql.includes("INSERT INTO public.app_operations")) {
          return { rowCount: 1, rows: [{ id: "operation-a" }] };
        }
        return { rowCount: null, rows: [] };
      }),
      release: vi.fn(),
    };
    mocks.coreConnect.mockResolvedValue(client);

    await expect(registerTemplateAppRevisionUpdate({
      actorId: "user-a",
      appId: "app-a",
      revisionId: "revision-2",
      operationKey: "update-a-2",
    })).resolves.toEqual({ appId: "app-a", operationId: "operation-a", reused: false });

    expect(client.query.mock.calls.map(([sql]) => sql)).toContain("COMMIT");
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes("UPDATE public.apps"),
    )).toBe(false);
    const insertCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO public.app_operations"),
    );
    expect(String(insertCall?.[1]?.[5])).toContain('"targetRevisionId":"revision-2"');
  });

  it("applies a compatible revision and atomically switches only the target App", async () => {
    const source = publishedDefinition("a".repeat(64));
    const target = publishedDefinition("b".repeat(64));
    target.pages[0].css = ".contacts { color: navy; }";
    mocks.coreQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{
        app_id: "app-a",
        tenant_db_name: "app_db_a",
        source_revision_id: "revision-1",
        source_definition: source,
        target_revision_id: "revision-2",
        target_digest: "b".repeat(64),
        target_definition: target,
        operation_status: "RUNNING",
      }] })
      .mockResolvedValue({ rowCount: 1, rows: [] });
    const tenant = { id: "tenant-pool-a" };
    mocks.openTenantDbByName.mockResolvedValue(tenant);
    mocks.applyAppSchema.mockResolvedValue({ revision: "b".repeat(64), tables: ["contacts"] });
    const activationClient = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => ({
        rowCount: sql.includes("UPDATE public.apps") ? 1 : null,
        rows: [],
      })),
      release: vi.fn(),
    };
    mocks.coreConnect.mockResolvedValue(activationClient);

    await expect(applyTemplateAppRevisionUpdate("app-a", "operation-a")).resolves.toMatchObject({
      appId: "app-a",
      revisionId: "revision-2",
      reused: false,
    });
    expect(mocks.openTenantDbByName).toHaveBeenCalledWith("app_db_a");
    expect(mocks.applyAppSchema).toHaveBeenCalledWith(tenant, target);
    const activation = activationClient.query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE public.apps"),
    );
    expect(activation?.[1]).toEqual([
      "app-a",
      "revision-1",
      "revision-2",
      "b".repeat(64),
    ]);
  });

  it("rejects Collection schema changes and leaves the active App revision untouched", async () => {
    const source = publishedDefinition("a".repeat(64));
    const target = publishedDefinition("b".repeat(64));
    target.collections[0].fields.push({
      id: "email",
      name: "Email",
      type: "string",
      required: false,
    });
    mocks.coreQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{
        app_id: "app-a",
        tenant_db_name: "app_db_a",
        source_revision_id: "revision-1",
        source_definition: source,
        target_revision_id: "revision-2",
        target_digest: "b".repeat(64),
        target_definition: target,
        operation_status: "RUNNING",
      }] })
      .mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(applyTemplateAppRevisionUpdate("app-a", "operation-a")).rejects.toMatchObject({
      code: "collection_schema_change_unsupported",
    });
    expect(mocks.openTenantDbByName).not.toHaveBeenCalled();
    expect(mocks.coreConnect).not.toHaveBeenCalled();
    expect(mocks.coreQuery.mock.calls.some(([sql]) =>
      String(sql).includes("status = 'FAILED'"),
    )).toBe(true);
  });
});
