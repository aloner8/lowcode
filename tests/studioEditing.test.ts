import { describe, expect, it } from "vitest";
import { buildScreenPageUpdate, moveItem, normalizePanels } from "@/lib/template/studioEditing";

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
});
