import { describe, expect, it } from "vitest";
import { adaptLegacyPlatform } from "@/lib/template/legacyAdapter";
import { validateTemplateDefinition } from "@/lib/template/validateTemplateDefinition";

describe("legacy Platform to Template adapter", () => {
  it("reports route Page semantics that a shared Screen cannot preserve", () => {
    const result = adaptLegacyPlatform({
      id: "old", customerId: "customer-a", platformSlug: "old", platformName: "Old",
      pages: [{ id: "first" }, { id: "second" }],
      routes: [
        { id: "home", path: "/", targetPageId: "first" },
        { id: "other", path: "/other", targetPageId: "second" },
      ],
    });
    expect(result.issues.filter((issue) => issue.code === "route_page_target_not_preserved")).toEqual([
      expect.objectContaining({ sourcePath: "routes[1].targetPageId" }),
    ]);
    expect(result.definition.screens[0].defaultPageId).toBe("first");
  });

  it("reports unsupported children, style, reusable references and events without echoing payloads", () => {
    const source = {
      id: "old", customerId: "customer-a", platformSlug: "old", platformName: "Old",
      pages: [{ id: "first", componentTree: [{
        id: "parent", type: "CardComponent", props: { content: "preserved" },
        style: { backgroundImage: "private-asset-url" },
        templateRef: "component://private", htmlId: "private-dom-id", label: "private-label",
        actionTriggerId: "private-workflow",
        children: [{ id: "child", type: "TextComponent", props: { content: "private-child" } }],
      }] }], routes: [],
    };
    const original = structuredClone(source);
    const result = adaptLegacyPlatform(source);
    expect(source).toEqual(original);
    expect(result.definition.componentInstances[0].props).toEqual({ content: "preserved" });
    expect(result.issues.filter((issue) => issue.sourcePath).map((issue) => issue.sourcePath)).toEqual([
      "pages[0].componentTree[0].children", "pages[0].componentTree[0].style",
      "pages[0].componentTree[0].templateRef", "pages[0].componentTree[0].htmlId",
      "pages[0].componentTree[0].label", "pages[0].componentTree[0].actionTriggerId",
    ]);
    expect(JSON.stringify(result.issues)).not.toContain("private-");
  });

  it("preserves Page and instance IDs while producing a valid definition", () => {
    const result = adaptLegacyPlatform({
      id: "platform-old",
      customerId: "customer-a",
      platformSlug: "old-platform",
      platformName: "Old Platform",
      pages: [
        {
          id: "page.home",
          title: "Home",
          componentTree: [
            {
              id: "instance.hero",
              type: "DynamicHtmlComponent",
              props: { content: "<h1>Hello</h1>" },
            },
          ],
        },
      ],
      routes: [
        { id: "route.home", path: "/", targetPageId: "page.home" },
      ],
    });

    expect(result.definition.pages[0].id).toBe("page.home");
    expect(result.definition.componentInstances[0].id).toBe("instance.hero");
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "screen_boundary_inferred" }),
    );
    expect(validateTemplateDefinition(result.definition)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("reports and removes a route whose Page target is missing", () => {
    const result = adaptLegacyPlatform({
      id: "platform-old",
      customerId: "customer-a",
      platformSlug: "old-platform",
      platformName: "Old Platform",
      pages: [{ id: "page.home" }],
      routes: [
        { id: "route.missing", path: "/missing", targetPageId: "page.missing" },
      ],
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "route_target_missing" }),
    );
    expect(result.definition.routes).toHaveLength(1);
    expect(result.definition.routes[0].path).toBe("/");
  });

  it("keeps reusable instances distinct from Standard Components", () => {
    const result = adaptLegacyPlatform({
      id: "platform-old",
      customerId: "customer-a",
      platformSlug: "old-platform",
      platformName: "Old Platform",
      pages: [
        {
          id: "page.home",
          componentTree: [
            {
              id: "instance.shared-card",
              type: "CardComponent",
              props: { __platformComponentId: "component.shared-card" },
            },
          ],
        },
      ],
      routes: [],
      reusableComponents: [
        {
          id: "component.shared-card",
          name: "Shared card",
          componentType: "standard",
          version: 1,
          definition: {},
        },
      ],
    });

    expect(result.definition.componentInstances[0]).toMatchObject({
      source: "reusable",
      componentId: "component.shared-card",
    });
    expect(validateTemplateDefinition(result.definition).valid).toBe(true);
  });
});
