import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";
import { createPublicTemplateExport } from "@/lib/template/publicTemplateExport";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ query: mocks.query }) }));

import { GET } from "@/app/api/templates/[id]/export/route";

const published = () => {
  const definition = structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;
  definition.template.status = "published";
  definition.template.revision = "a".repeat(64);
  definition.startup.connectionProfileRef = "connection.private";
  definition.modules = [{
    id: "module.auth",
    moduleKey: "auth",
    enabled: true,
    config: {
      providers: ["local"],
      allowRegister: false,
      afterLogin: "/",
      secretToken: "env://PRIVATE_TOKEN",
    },
  }];
  return definition;
};

describe("Public Template export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes tenant identity, connection references, and secret-like config", () => {
    const result = createPublicTemplateExport({
      slug: "contacts",
      name: "Contacts",
      description: null,
      revision: 2,
      digest: "a".repeat(64),
      definition: published(),
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("customer.demo");
    expect(serialized).not.toContain("connection.private");
    expect(serialized).not.toContain("PRIVATE_TOKEN");
    expect(result.definition).toMatchObject({
      modules: [{ moduleKey: "auth", config: { providers: ["local"], allowRegister: false } }],
      collections: [expect.objectContaining({ tableName: "contacts" })],
    });
  });

  it("exports only the current published revision of a Public Template", async () => {
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [{
        template_slug: "contacts",
        template_name: "Contacts",
        description: "Reusable contact layout",
        revision_number: "2",
        revision_digest: "a".repeat(64),
        compiled_definition: published(),
      }],
    });
    const response = await GET(new Request("http://local/api/templates/template-a/export"), {
      params: Promise.resolve({ id: "template-a" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[0][0]).toContain("template.is_public = true");
    expect(mocks.query.mock.calls[0][0]).toContain("template.published_revision_id");
    expect(mocks.query.mock.calls[0][1]).toEqual(["template-a"]);
    await expect(response.json()).resolves.toMatchObject({
      export: { format: "lowcode-public-template", template: { slug: "contacts", revision: 2 } },
    });
  });

  it("does not reveal whether a private or unpublished Template exists", async () => {
    mocks.query.mockResolvedValue({ rowCount: 0, rows: [] });
    const response = await GET(new Request("http://local"), {
      params: Promise.resolve({ id: "private-template" }),
    });
    expect(response.status).toBe(404);
  });
});
