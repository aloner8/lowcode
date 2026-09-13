import { describe, expect, it } from "vitest";
import { COMPONENT_PALETTE, COMPONENT_REGISTRY } from "@/lib/engine/ComponentRegistry";
import { SHARED_COMPONENT_PROPERTY_REGISTRY } from "@/lib/studio/sharedComponentPropertyRegistry";

describe("shared Component authoring registry", () => {
  it("gives every palette Component both a renderer and a PropertyPage schema", () => {
    for (const item of COMPONENT_PALETTE) {
      expect(COMPONENT_REGISTRY[item.type], `${item.type} renderer`).toBeTypeOf("function");
      expect(SHARED_COMPONENT_PROPERTY_REGISTRY[item.type], `${item.type} property schema`)
        .toMatchObject({ type: item.type });
    }
  });

  it("keeps palette Component types unique", () => {
    const types = COMPONENT_PALETTE.map((item) => item.type);
    expect(new Set(types).size).toBe(types.length);
  });
});
