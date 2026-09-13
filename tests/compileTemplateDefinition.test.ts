import { describe, expect, it } from "vitest";
import {
  compileTemplateDefinition,
  stableStringify,
  type CompilableObjectRow,
} from "@/lib/template/compileTemplateDefinition";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const row = (
  objectType: string,
  objectKey: string,
  objectName: string,
  definition: object,
): CompilableObjectRow => ({
  id: `db:${objectType}:${objectKey}`,
  object_type: objectType,
  object_key: objectKey,
  object_name: objectName,
  definition: structuredClone(definition) as Record<string, unknown>,
});

const fixture = () => {
  const source = structuredClone(
    MINIMAL_TEMPLATE_DEFINITION,
  ) as TemplateDefinition;
  return {
    template: {
      id: source.template.id,
      customer_id: source.template.customerId,
      template_name: source.template.name,
      edit_version: source.template.editVersion,
    },
    objects: [
      row("STARTUP", "startup", "Startup", source.startup),
      ...source.routes.map((item) => row("ROUTE", item.id, item.id, item)),
      ...source.screens.map((item) => row("SCREEN", item.id, item.name, item)),
      ...source.pages.map((item) => row("PAGE", item.id, item.name, item)),
      ...source.componentInstances.map((item) =>
        row("COMPONENT_INSTANCE", item.id, item.id, item),
      ),
      ...source.collections.map((item) =>
        row("COLLECTION", item.id, item.name, item),
      ),
    ],
    screenPages: [
      {
        screen_key: "screen.main",
        page_key: "page.contacts",
        sort_order: 0,
        is_default: true,
      },
    ],
  };
};

describe("Template revision compiler", () => {
  it("assembles normalized Object rows into a valid immutable definition", () => {
    const source = fixture();
    const result = compileTemplateDefinition(
      source.template,
      source.objects,
      source.screenPages,
      "revision-1",
    );

    expect(result.issues).toEqual([]);
    expect(result.definition.template).toMatchObject({
      status: "published",
      revision: "revision-1",
    });
    expect(result.definition.componentInstances[0]).toMatchObject({
      id: "instance.contacts-table",
      source: "standard",
    });
  });

  it("uses the normalized Screen/Page relation as the default source", () => {
    const source = fixture();
    const screen = source.objects.find((item) => item.object_type === "SCREEN")!;
    screen.definition.defaultPageId = "page.wrong";

    const result = compileTemplateDefinition(
      source.template,
      source.objects,
      source.screenPages,
      "revision-1",
    );

    expect(result.issues).toEqual([]);
    expect(result.definition.screens[0].defaultPageId).toBe("page.contacts");
  });

  it("compiles an editable Draft without claiming an immutable revision", () => {
    const source = fixture();
    const result = compileTemplateDefinition(
      source.template,
      source.objects,
      source.screenPages,
    );

    expect(result.issues).toEqual([]);
    expect(result.definition.template.status).toBe("draft");
    expect(result.definition.template.revision).toBeUndefined();
  });

  it("rejects an incomplete Startup Object", () => {
    const source = fixture();
    const startup = source.objects.find((item) => item.object_type === "STARTUP")!;
    startup.definition = {};

    const result = compileTemplateDefinition(
      source.template,
      source.objects,
      source.screenPages,
      "revision-1",
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_startup_css" }),
        expect.objectContaining({ code: "invalid_startup_actions" }),
      ]),
    );
  });

  it("serializes object keys deterministically", () => {
    expect(stableStringify({ z: 1, nested: { b: true, a: false }, a: 2 })).toBe(
      '{"a":2,"nested":{"a":false,"b":true},"z":1}',
    );
  });
});
