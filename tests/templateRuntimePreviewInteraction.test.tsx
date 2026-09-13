// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateRuntimePreview } from "@/components/template-studio/TemplateRuntimePreview";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";
import type { TemplateDefinition } from "@/lib/template/contracts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const previewDefinition = (): TemplateDefinition => {
  const definition = structuredClone(MINIMAL_TEMPLATE_DEFINITION) as TemplateDefinition;
  definition.pages.push({
    id: "page.details",
    name: "Details",
    panels: [{ id: "panel.details", name: "Details", order: 0, responsive: { desktop: 12, tablet: 12, mobile: 12 } }],
    collections: [],
    css: "",
  });
  definition.screenPages.push({ screenId: "screen.main", pageId: "page.details", sortOrder: 1 });
  definition.popups.push({ id: "popup.info", pageId: "page.details" });
  definition.screens[0].popupIds.push("popup.info");
  definition.screens[0].menu = [
    { id: "menu.details", label: "Details", action: { type: "change_page", pageId: "page.details" } },
    { id: "menu.info", label: "Open info", action: { type: "open_popup", popupId: "popup.info" } },
  ];
  definition.componentInstances.push({
    id: "instance.details",
    placement: "page_panel",
    pageId: "page.details",
    panelId: "panel.details",
    loadOrder: 0,
    source: "standard",
    standardType: "CardComponent",
    props: { title: "Details card", value: "Ready" },
    bindings: {},
  });
  return definition;
};

describe("Template Draft Preview browser interactions", () => {
  it("runs Change Page and Open Popup menu actions", async () => {
    const user = userEvent.setup();
    const definition = previewDefinition();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ definition }),
      { status: 200, headers: { "content-type": "application/json" } },
    )));

    render(<TemplateRuntimePreview templateId="template-a" onClose={vi.fn()} />);
    await screen.findByRole("button", { name: "Details" });

    await user.click(screen.getByRole("button", { name: "Details" }));
    await waitFor(() => expect(screen.getByText("Details card")).toBeTruthy());

    await user.click(screen.getByRole("button", { name: "Open info" }));
    expect(await screen.findByLabelText("Preview popup")).toBeTruthy();
    expect(screen.getAllByText("Details card").length).toBeGreaterThan(0);
  });
});
