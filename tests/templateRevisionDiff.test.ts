import { describe, expect, it } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";
import { diffTemplateRevisions } from "@/lib/template/templateRevisionDiff";

const definition = () => structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;

describe("Template revision diff", () => {
  it("lists the complete draft when no revision has been published", () => {
    const result = diffTemplateRevisions(null, definition());

    expect(result.removed).toBe(0);
    expect(result.changed).toBe(0);
    expect(result.added).toBe(result.changes.length);
    expect(result.changes).toEqual(expect.arrayContaining([
      { kind: "added", objectType: "TEMPLATE", objectKey: "template.contacts" },
      { kind: "added", objectType: "STARTUP", objectKey: "startup" },
      { kind: "added", objectType: "PAGE", objectKey: "page.contacts" },
    ]));
  });

  it("ignores publication identity while reporting object-level changes", () => {
    const published = definition();
    published.template.status = "published";
    published.template.revision = "a".repeat(64);
    const draft = definition();
    draft.template.editVersion += 3;
    draft.pages[0].css = ".contacts { color: navy; }";
    draft.collections = [];
    draft.popups.push({ id: "popup.help", pageId: "page.contacts" });

    expect(diffTemplateRevisions(published, draft)).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      changes: [
        { kind: "removed", objectType: "COLLECTION", objectKey: "collection.contacts" },
        { kind: "changed", objectType: "PAGE", objectKey: "page.contacts" },
        { kind: "added", objectType: "POPUP", objectKey: "popup.help" },
      ],
    });
  });
});
