import { describe, expect, it } from "vitest";
import { buildScreenPageUpdate, componentPlacementKey, moveItem, normalizeEventSteps, normalizePanels, orderComponents, parseStudioValue, placementOf, renameRecordKey } from "@/lib/template/studioEditing";

describe("Template Studio editing helpers", () => {
  it("reorders without mutating the input", () => {
    const input = ["a", "b", "c"];
    expect(moveItem(input, 2, 0)).toEqual(["c", "a", "b"]);
    expect(input).toEqual(["a", "b", "c"]);
  });

  it("normalizes panel order and clamps responsive widths", () => {
    expect(normalizePanels([{ id: "a", name: "A", order: 8, responsive: { desktop: 20, tablet: 0, mobile: 6.4 } }]))
      .toEqual([{ id: "a", name: "A", order: 0, responsive: { desktop: 12, tablet: 1, mobile: 6 } }]);
  });

  it("deduplicates pages and guarantees exactly one default", () => {
    expect(buildScreenPageUpdate(["page-b", "page-a", "page-b"], "missing")).toEqual([
      { pageObjectId: "page-b", sortOrder: 0, isDefault: true },
      { pageObjectId: "page-a", sortOrder: 1, isDefault: false },
    ]);
  });

  it("preserves scalar property types entered in structured editors", () => {
    expect(parseStudioValue("true")).toBe(true);
    expect(parseStudioValue("12.5")).toBe(12.5);
    expect(parseStudioValue("0012")).toBe("0012");
    expect(parseStudioValue(" hello ")).toBe(" hello ");
  });

  it("renames property keys without overwriting a sibling", () => {
    expect(renameRecordKey({ title: "A", count: 2 }, "title", "label"))
      .toEqual({ label: "A", count: 2 });
    expect(renameRecordKey({ title: "A", count: 2 }, "title", "count"))
      .toEqual({ title: "A", count: 2 });
  });

  it("normalizes Screen event order after drag-style reordering", () => {
    expect(normalizeEventSteps([
      { id: "b", phase: "afterLoad", order: 8, action: "second" },
      { id: "a", phase: "onload", order: 2, action: "first" },
    ]).map((step) => step.order)).toEqual([0, 1]);
  });

  it("creates stable placement identities for page panels and Screen regions", () => {
    expect(componentPlacementKey({ placement: "page_panel", pageId: "page.home", panelId: "main" }))
      .toBe("page_panel:page.home:main");
    expect(placementOf({ placement: "screen_region", screenId: "screen.main", region: "header" }))
      .toEqual({ placement: "screen_region", screenId: "screen.main", region: "header" });
    expect(placementOf({ placement: "page_panel", pageId: "", panelId: "main" })).toBeNull();
  });

  it("orders component instances by loadOrder without mutating server state", () => {
    const input = [
      { id: "b", objectKey: "instance.b", editVersion: 1, definition: { loadOrder: 2 } },
      { id: "a", objectKey: "instance.a", editVersion: 1, definition: { loadOrder: 0 } },
    ];
    expect(orderComponents(input).map((item) => item.id)).toEqual(["a", "b"]);
    expect(input.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
