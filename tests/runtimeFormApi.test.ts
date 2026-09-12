import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.query }),
}));

import { GET } from "@/app/api/runtime/[slug]/form/route";

const published = (): TemplateDefinition => {
  const definition = structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;
  definition.template.status = "published";
  definition.template.revision = "e".repeat(64);
  return definition;
};

describe("runtime api/form", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the immutable App definition without the server connection profile", async () => {
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          app_slug: "app-a",
          revision_digest: "e".repeat(64),
          schema_version: "1.0.0",
          compiled_definition: published(),
        },
      ],
    });

    const response = await GET(
      new Request("http://local/api/runtime/app-a/form?routeId=route.home"),
      { params: Promise.resolve({ slug: "app-a" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.revision.digest).toBe("e".repeat(64));
    expect(body.requestedRouteId).toBe("route.home");
    expect(body.definition.startup.connectionProfileRef).toBeUndefined();
    expect(mocks.query.mock.calls[0][0]).toContain("customer.status = 'ACTIVE'");
  });

  it("does not return a definition for an unknown Route", async () => {
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          app_slug: "app-a",
          revision_digest: "e".repeat(64),
          schema_version: "1.0.0",
          compiled_definition: published(),
        },
      ],
    });

    const response = await GET(
      new Request("http://local/api/runtime/app-a/form?routeId=route.missing"),
      { params: Promise.resolve({ slug: "app-a" }) },
    );
    expect(response.status).toBe(404);
  });
});
