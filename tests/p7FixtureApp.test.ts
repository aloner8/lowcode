import { describe, expect, it, vi } from "vitest";
import { LifecycleRunner, type LifecycleAdapter } from "@/lib/runtime/lifecycleRunner";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { validateTemplateDefinition } from "@/lib/template/validateTemplateDefinition";
import {
  createP7FixtureDefinition,
  P7_FIXTURE_IDS,
} from "../scripts/p7-fixture-app-rehearsal.mjs";

describe("P7 self-contained fixture App", () => {
  it("builds a valid published definition with stable legacy mappings", () => {
    const revision = "a".repeat(64);
    const definition = createP7FixtureDefinition(revision) as TemplateDefinition;

    expect(validateTemplateDefinition(definition)).toEqual({ valid: true, issues: [] });
    expect(definition.template).toMatchObject({
      id: P7_FIXTURE_IDS.template,
      customerId: P7_FIXTURE_IDS.customer,
      status: "published",
      revision,
    });
    expect(definition.componentInstances[0]).toMatchObject({
      componentId: "hero-card",
      bindings: { rows: "contacts.rows" },
    });
  });

  it("runs the fixture through the real lifecycle and preserves collection data", async () => {
    const definition = createP7FixtureDefinition("b".repeat(64)) as TemplateDefinition;
    const events: string[] = [];
    const adapter: LifecycleAdapter = {
      emit: (event) => {
        events.push(event.phase);
      },
      runScreenStep: vi.fn(),
      loadCollection: vi.fn(async () => [{ id: 1, name: "สมชาย หลังย้าย", email: "somchai@example.test" }]),
      prepareScreenComponent: vi.fn(),
      prepareComponent: vi.fn(),
    };
    let id = 0;
    const runner = new LifecycleRunner(
      definition,
      P7_FIXTURE_IDS.app,
      definition.template.revision!,
      adapter,
      (scope) => `${scope}-${++id}`,
    );

    const result = await runner.navigateRoute("route.home");

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.page.data.contacts).toEqual([
        { id: 1, name: "สมชาย หลังย้าย", email: "somchai@example.test" },
      ]);
    }
    expect(adapter.loadCollection).toHaveBeenCalledOnce();
    expect(adapter.prepareComponent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "instance.contacts" }),
      expect.anything(),
      expect.any(AbortSignal),
    );
    expect(events.at(-1)).toBe("screen_after_change_page");
  });

  it("does not accept external resources or credentials", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("../scripts/p7-fixture-app-rehearsal.mjs", import.meta.url), "utf8"),
    );
    expect(source).toContain("process.argv.length !== 2");
    expect(source).toContain("'--network','bridge'");
    expect(source).toContain("'--publish','127.0.0.1::5432'");
    expect(source).not.toContain("CORE_DATABASE_URL");
    expect(source).not.toContain("APP_PROVISION_TEST_DATABASE_URL");
  });
});
