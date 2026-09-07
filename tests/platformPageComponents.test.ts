import { describe, expect, it } from "vitest";
import {
  getHydratedPageComponentUpdates,
  stripHydratedPageComponentNodes,
} from "@/lib/engine/platformPageComponents";
import type { ComponentNode } from "@/types";

describe("hydrated page components", () => {
  const node: ComponentNode = {
    id: "auth.login.form",
    type: "FormComponent",
    label: "JWT Login Form",
    actionTriggerId: "auth.login.submit",
    props: {
      title: "Sign in",
      fields: [{ name: "email", label: "Username", type: "text" }],
      requestBindings: { currentUser: "auth.currentUser" },
      responseBindings: { formData: "formData" },
      __layoutRegion: "content",
      __sectionId: "content",
      __platformComponentId: "component-id",
      __platformComponentVersion: 2,
      __pageComponentInstanceId: "auth.login.form",
    },
  };

  it("turns edited hydrated props into page component instance overrides", () => {
    expect(getHydratedPageComponentUpdates([node])).toEqual([
      {
        instanceKey: "auth.login.form",
        instanceName: "JWT Login Form",
        layoutRegion: "content",
        propsOverrides: {
          title: "Sign in",
          fields: [{ name: "email", label: "Username", type: "text" }],
          actionTriggerId: "auth.login.submit",
        },
        requestBindings: { currentUser: "auth.currentUser" },
        responseBindings: { formData: "formData" },
      },
    ]);
  });

  it("keeps hydrated nodes out of the embedded page tree", () => {
    expect(stripHydratedPageComponentNodes([node])).toEqual([]);
  });
});
