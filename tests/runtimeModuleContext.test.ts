import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  resolveAppServiceBindings: vi.fn(),
}));
vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ query: mocks.query }) }));
vi.mock("@/lib/services/appBindings", () => ({ resolveAppServiceBindings: mocks.resolveAppServiceBindings }));

import { resolveRuntimeContext } from "@/lib/services/runtimeContext";

describe("runtime Module context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAppServiceBindings.mockResolvedValue([]);
  });

  it("loads Module Settings from the App's immutable active Template revision", async () => {
    const modules = [{ moduleKey: "files", enabled: true, config: { workingPath: "/records" } }];
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [{
        platform_id: "platform-a",
        app_id: "app-a",
        platform_slug: "platform",
        app_slug: "records",
        runtime_snapshot: { services: [] },
        runtime_build_revision: "build-a",
        template_modules: modules,
      }],
    });

    const result = await resolveRuntimeContext(new Request("https://app.example/api"), "records");
    expect(result?.snapshot.templateModules).toEqual(modules);
    expect(mocks.query.mock.calls[0][0]).toContain("public.template_revisions");
    expect(mocks.query.mock.calls[0][0]).toContain("compiled_definition->'modules'");
  });
});
