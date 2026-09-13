import { describe, expect, it } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";
import { validateTemplateDefinition } from "@/lib/template/validateTemplateDefinition";

const cloneDefinition = (): TemplateDefinition =>
  structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;

describe("template definition foundation contract", () => {
  it("validates the minimal end-to-end definition", () => {
    expect(validateTemplateDefinition(cloneDefinition())).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("requires the default page to belong to the screen", () => {
    const definition = cloneDefinition();
    definition.screenPages = [];

    expect(validateTemplateDefinition(definition).issues).toContainEqual(
      expect.objectContaining({ code: "default_page_not_in_screen" }),
    );
  });

  it("rejects references to a component instance on a missing panel", () => {
    const definition = cloneDefinition();
    const instance = definition.componentInstances[0];
    if (instance.placement !== "page_panel") throw new Error("Expected page panel placement");
    instance.panelId = "panel.missing";

    expect(validateTemplateDefinition(definition).issues).toContainEqual(
      expect.objectContaining({ code: "missing_panel" }),
    );
  });

  it("requires an immutable revision for published definitions", () => {
    const definition = cloneDefinition();
    definition.template.status = "published";

    expect(validateTemplateDefinition(definition).issues).toContainEqual(
      expect.objectContaining({ code: "revision_required" }),
    );
  });

  it("rejects collection relations to unknown fields", () => {
    const definition = cloneDefinition();
    definition.collections[0].fields.push({
      id: "manager_id",
      name: "Manager",
      type: "integer",
      required: false,
      references: {
        collectionId: "collection.contacts",
        fieldId: "missing",
      },
    });

    expect(validateTemplateDefinition(definition).issues).toContainEqual(
      expect.objectContaining({ code: "missing_collection_field" }),
    );
  });

  it("rejects physical identifiers that cannot be safely provisioned", () => {
    const definition = cloneDefinition();
    definition.collections[0].tableName = "contacts;drop";

    expect(validateTemplateDefinition(definition).issues).toContainEqual(
      expect.objectContaining({ code: "invalid_table_name" }),
    );
  });

  it("requires a menu Popup target to be assigned to the same Screen", () => {
    const definition = cloneDefinition();
    definition.popups.push({ id: "popup.contact", pageId: "page.contacts" });
    definition.screens[0].menu.push({
      id: "menu.popup",
      label: "Contact popup",
      action: { type: "open_popup", popupId: "popup.contact" },
    });

    expect(validateTemplateDefinition(definition).issues).toContainEqual(
      expect.objectContaining({ code: "popup_not_in_screen" }),
    );

    definition.screens[0].popupIds.push("popup.contact");
    expect(validateTemplateDefinition(definition).issues).not.toContainEqual(
      expect.objectContaining({ code: "popup_not_in_screen" }),
    );
  });
});
