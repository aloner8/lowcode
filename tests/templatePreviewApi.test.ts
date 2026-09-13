import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  requireApiSession: vi.fn(),
  requireTemplateAccess: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ connect: mocks.connect }) }));
vi.mock("@/lib/auth/apiAuth", () => ({
  requireApiSession: mocks.requireApiSession,
  requireTemplateAccess: mocks.requireTemplateAccess,
}));

import { GET } from "@/app/api/templates/[id]/preview/route";

const objectRows = () => {
  const source = structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;
  return [
    { id: "startup", object_type: "STARTUP", object_key: "startup", object_name: "Startup", definition: source.startup },
    ...source.routes.map((item) => ({ id: item.id, object_type: "ROUTE", object_key: item.id, object_name: item.id, definition: item })),
    ...source.screens.map((item) => ({ id: item.id, object_type: "SCREEN", object_key: item.id, object_name: item.name, definition: item })),
    ...source.pages.map((item) => ({ id: item.id, object_type: "PAGE", object_key: item.id, object_name: item.name, definition: item })),
    ...source.componentInstances.map((item) => ({ id: item.id, object_type: "COMPONENT_INSTANCE", object_key: item.id, object_name: item.id, definition: item })),
    ...source.collections.map((item) => ({ id: item.id, object_type: "COLLECTION", object_key: item.id, object_name: item.name, definition: item })),
  ];
};

describe("Template preview API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue({ sub: "user-a", role: "TENANT_USER" });
    mocks.requireTemplateAccess.mockResolvedValue(null);
  });

  it("compiles a consistent Draft snapshot without exposing its connection profile", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM public.templates")) return { rowCount: 1, rows: [{ id: "template-a", customer_id: "customer-a", template_name: "A", edit_version: "4" }] };
      if (sql.includes("FROM public.template_objects")) return { rowCount: 6, rows: objectRows() };
      if (sql.includes("FROM public.template_screen_pages")) return { rowCount: 1, rows: [{ screen_key: "screen.main", page_key: "page.contacts", sort_order: 0, is_default: true }] };
      return { rowCount: null, rows: [] };
    });
    mocks.connect.mockResolvedValue({ query, release: vi.fn() });

    const response = await GET(new Request("http://local"), {
      params: Promise.resolve({ id: "template-a" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.definition.template).toMatchObject({ status: "draft", editVersion: 4 });
    expect(body.definition.startup.connectionProfileRef).toBeUndefined();
    expect(query.mock.calls.map(([sql]) => sql)).toContain("COMMIT");
  });
});
