import { describe, expect, it } from "vitest";
import {
  LifecycleRunner,
  type LifecycleAdapter,
  type LifecycleTraceEvent,
} from "@/lib/runtime/lifecycleRunner";
import type {
  AppComponentInstanceDefinition,
  JsonValue,
  PageCollectionLoadDefinition,
  TemplateDefinition,
} from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const definitionWithPages = (): TemplateDefinition => {
  const definition = structuredClone(
    MINIMAL_TEMPLATE_DEFINITION,
  ) as TemplateDefinition;
  definition.pages.push(
    {
      id: "page.second",
      name: "Second",
      panels: [
        {
          id: "panel.second",
          name: "Second panel",
          order: 0,
          responsive: { desktop: 12, tablet: 12, mobile: 12 },
        },
      ],
      collections: [
        { collectionId: "collection.second-a", loadOrder: 20, alias: "late" },
        { collectionId: "collection.second-b", loadOrder: 10, alias: "early" },
      ],
      css: "",
    },
    {
      id: "page.third",
      name: "Third",
      panels: [
        {
          id: "panel.third",
          name: "Third panel",
          order: 0,
          responsive: { desktop: 12, tablet: 12, mobile: 12 },
        },
      ],
      collections: [],
      css: "",
    },
  );
  definition.screenPages.push(
    { screenId: "screen.main", pageId: "page.second", sortOrder: 1 },
    { screenId: "screen.main", pageId: "page.third", sortOrder: 2 },
  );
  definition.collections.push(
    {
      id: "collection.second-a",
      name: "Second A",
      tableName: "second_a",
      fields: [{ id: "id", name: "ID", type: "integer", required: true }],
    },
    {
      id: "collection.second-b",
      name: "Second B",
      tableName: "second_b",
      fields: [{ id: "id", name: "ID", type: "integer", required: true }],
    },
  );
  definition.componentInstances.push(
    {
      id: "instance.screen-late",
      placement: "screen_region",
      screenId: "screen.main",
      region: "header",
      loadOrder: 20,
      source: "standard",
      standardType: "SiteHeaderComponent",
      props: {},
      bindings: {},
    },
    {
      id: "instance.screen-early",
      placement: "screen_region",
      screenId: "screen.main",
      region: "header",
      loadOrder: 10,
      source: "standard",
      standardType: "SiteTopbarComponent",
      props: {},
      bindings: {},
    },
    {
      id: "instance.second-late",
      placement: "page_panel",
      pageId: "page.second",
      panelId: "panel.second",
      loadOrder: 20,
      source: "standard",
      standardType: "CardComponent",
      props: {},
      bindings: {},
    },
    {
      id: "instance.second-early",
      placement: "page_panel",
      pageId: "page.second",
      panelId: "panel.second",
      loadOrder: 10,
      source: "standard",
      standardType: "CardComponent",
      props: {},
      bindings: {},
    },
  );
  const header = definition.screens[0].regions.find(
    (region) => region.key === "header",
  )!;
  header.componentInstanceIds = ["instance.screen-late", "instance.screen-early"];
  return definition;
};

const ids = () => {
  let sequence = 0;
  return (scope: "request" | "screen" | "page") => `${scope}-${++sequence}`;
};

const adapter = (overrides: Partial<LifecycleAdapter> = {}) => {
  const events: LifecycleTraceEvent[] = [];
  const collections: string[] = [];
  const components: string[] = [];
  const value: LifecycleAdapter = {
    emit: (event) => {
      events.push(event);
    },
    runScreenStep: async () => undefined,
    loadCollection: async (load) => {
      collections.push(load.alias);
      return [];
    },
    prepareScreenComponent: async (component) => {
      components.push(component.id);
    },
    prepareComponent: async (component) => {
      components.push(component.id);
    },
    ...overrides,
  };
  return { value, events, collections, components };
};

describe("Screen/Page lifecycle runner", () => {
  it("emits Complete/After phases in the defined order", async () => {
    const target = adapter();
    const runner = new LifecycleRunner(
      definitionWithPages(),
      "app-a",
      "revision-1",
      target.value,
      ids(),
    );

    expect((await runner.navigateRoute("route.home")).status).toBe("ready");
    expect(target.events.map((event) => event.phase)).toEqual([
      "app_startup",
      "screen_onload",
      "screen_load_complete",
      "screen_after_load",
      "screen_set_layout",
      "screen_set_layout_complete",
      "screen_after_set_layout",
      "screen_change_page",
      "page_onload",
      "page_onload_complete",
      "page_components_complete",
      "page_ready",
      "screen_change_page_complete",
      "screen_after_change_page",
    ]);
  });

  it("keeps Screen memory across ChangePage and resets it on Route reload", async () => {
    const target = adapter();
    const runner = new LifecycleRunner(
      definitionWithPages(),
      "app-a",
      "revision-1",
      target.value,
      ids(),
    );

    await runner.navigateRoute("route.home");
    const firstScreen = runner.currentScreen!;
    firstScreen.memory.userChoice = "kept";
    runner.currentPage!.memory.formDraft = "page-only";

    await runner.changePage("page.second");
    expect(runner.currentScreen).toBe(firstScreen);
    expect(runner.currentScreen?.memory).toEqual({ userChoice: "kept" });
    expect(runner.currentPage?.memory).toEqual({});

    await runner.reload();
    expect(runner.currentScreen).not.toBe(firstScreen);
    expect(runner.currentScreen?.screenInstanceId).not.toBe(
      firstScreen.screenInstanceId,
    );
    expect(runner.currentScreen?.memory).toEqual({});
  });

  it("loads Collections and Components sequentially by loadOrder", async () => {
    const target = adapter();
    const runner = new LifecycleRunner(
      definitionWithPages(),
      "app-a",
      "revision-1",
      target.value,
      ids(),
    );
    await runner.navigateRoute("route.home");
    expect(target.components).toEqual([
      "instance.screen-early",
      "instance.screen-late",
      "instance.contacts-table",
    ]);
    target.collections.length = 0;
    target.components.length = 0;

    await runner.changePage("page.second");

    expect(target.collections).toEqual(["early", "late"]);
    expect(target.components).toEqual([
      "instance.second-early",
      "instance.second-late",
    ]);
  });

  it("does not let a stale slow Page replace the latest Page", async () => {
    let resolveSlow!: (value: JsonValue) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const slow = new Promise<JsonValue>((resolve) => {
      resolveSlow = resolve;
    });
    const target = adapter({
      loadCollection: async (load: PageCollectionLoadDefinition) => {
        if (load.alias === "early") {
          markStarted();
          return slow;
        }
        return [];
      },
    });
    const runner = new LifecycleRunner(
      definitionWithPages(),
      "app-a",
      "revision-1",
      target.value,
      ids(),
    );
    await runner.navigateRoute("route.home");

    const staleChange = runner.changePage("page.second");
    await started;
    const latestChange = await runner.changePage("page.third");
    resolveSlow([]);

    expect(latestChange.status).toBe("ready");
    expect((await staleChange).status).toBe("cancelled");
    expect(runner.currentPage?.pageId).toBe("page.third");
  });

  it("keeps the current Page visible when the target Page fails", async () => {
    const failures: Array<{ objectId: string; phase: string }> = [];
    const target = adapter({
      loadCollection: async (load: PageCollectionLoadDefinition) => {
        if (load.alias === "early") throw new Error("collection unavailable");
        return [];
      },
      prepareComponent: async (_component: AppComponentInstanceDefinition) => undefined,
      onFailure: async (failure) => {
        failures.push({ objectId: failure.objectId, phase: failure.phase });
      },
    });
    const runner = new LifecycleRunner(
      definitionWithPages(),
      "app-a",
      "revision-1",
      target.value,
      ids(),
    );
    await runner.navigateRoute("route.home");

    const result = await runner.changePage("page.second");

    expect(result.status).toBe("error");
    expect(failures).toEqual([
      { objectId: "collection.second-b", phase: "page_collection_load" },
    ]);
    expect(runner.currentPage?.pageId).toBe("page.contacts");
  });
});
