import { describe, expect, it } from "vitest";
import { resolveBindingPath, resolveComponentProps } from "@/lib/runtime/resolveComponentBindings";
import type { AppComponentInstanceDefinition } from "@/lib/template/contracts";

const instance: AppComponentInstanceDefinition = {
  id: "instance.contacts",
  placement: "page_panel",
  pageId: "page.contacts",
  panelId: "main",
  loadOrder: 0,
  source: "standard",
  standardType: "DataTableComponent",
  props: { title: "Contacts", rows: [] },
  bindings: { rows: "contacts.rows", names: "contacts.name" },
};

describe("component binding resolver", () => {
  const data = {
    contacts: [
      { id: 1, name: "Ada" },
      { id: 2, name: "Grace" },
    ],
  };

  it("resolves a whole Collection result through the rows convention", () => {
    expect(resolveBindingPath(data, "contacts.rows")).toEqual(data.contacts);
    expect(resolveBindingPath(data, "contacts")).toEqual(data.contacts);
  });

  it("projects a Collection field and leaves unknown paths unresolved", () => {
    expect(resolveBindingPath(data, "contacts.name")).toEqual(["Ada", "Grace"]);
    expect(resolveBindingPath(data, "missing.rows")).toBeUndefined();
  });

  it("merges resolved bindings over authored props", () => {
    expect(resolveComponentProps(instance, data)).toMatchObject({
      title: "Contacts",
      rows: data.contacts,
      names: ["Ada", "Grace"],
    });
  });
});
