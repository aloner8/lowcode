// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplatePropertyEditor } from "@/components/template-studio/TemplatePropertyEditor";
import { TemplateStudioClient } from "@/components/template-studio/TemplateStudioClient";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const page = {
  id: "page-row",
  objectType: "PAGE",
  objectKey: "page.contacts",
  objectName: "Contacts",
  editVersion: 1,
  definition: {
    panels: [{ id: "main", name: "Main", order: 0, responsive: { desktop: 12, tablet: 12, mobile: 12 } }],
    collections: [{ collectionId: "collection.contacts", alias: "contacts", loadOrder: 0 }],
    css: "",
  },
};

const collection = {
  id: "collection-row",
  objectType: "COLLECTION",
  objectKey: "collection.contacts",
  objectName: "Contacts",
  editVersion: 1,
  definition: {
    tableName: "contacts",
    fields: [
      { id: "id", name: "ID", type: "integer", required: true, primaryKey: true },
      { id: "name", name: "Name", type: "string", required: true },
    ],
  },
};

describe("Template Studio browser interactions", () => {
  it("creates an Object through the Studio API flow without JSON editing", async () => {
    const user = userEvent.setup();
    const objects: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/templates/template-a/objects") && method === "POST") {
        const payload = JSON.parse(String(init?.body));
        const saved = {
          id: "startup-row",
          objectType: payload.objectType,
          objectKey: payload.objectKey,
          objectName: payload.objectName,
          editVersion: 1,
          definition: payload.definition,
        };
        objects.push(saved);
        return new Response(JSON.stringify({ object: saved }), { status: 201 });
      }
      if (url.endsWith("/api/templates/template-a/objects")) {
        return new Response(JSON.stringify({ objects }), { status: 200 });
      }
      if (url.endsWith("/api/templates/template-a/screen-pages")) {
        return new Response(JSON.stringify({ screenPages: [] }), { status: 200 });
      }
      if (url.endsWith("/api/templates/template-a")) {
        return new Response(JSON.stringify({ template: { id: "template-a", templateName: "Demo", templateSlug: "demo", isPublic: false, editVersion: 1, publishedRevisionId: null } }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TemplateStudioClient templateId="template-a" />);
    const name = await screen.findByPlaceholderText("ชื่อ On Start Up");
    await user.type(name, "Application startup");
    await user.click(screen.getByRole("button", { name: /สร้างโดยไม่แก้ JSON/i }));

    expect(await screen.findByText("Application startup")).toBeTruthy();
    const createCall = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith("/objects") && init?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      objectType: "STARTUP",
      expectedEditVersion: 0,
      definition: { mainCss: "", browserActions: [] },
    });
  });

  it("edits registry-backed Props and adds a schema-assisted binding", async () => {
    const user = userEvent.setup();
    const onSaveDefinition = vi.fn(async (_definition: Record<string, unknown>) => undefined);
    const instance = {
      id: "instance-row",
      objectType: "COMPONENT_INSTANCE",
      objectKey: "instance.contacts",
      objectName: "Contacts table",
      editVersion: 1,
      definition: {
        placement: "page_panel",
        pageId: "page.contacts",
        panelId: "main",
        loadOrder: 0,
        source: "standard",
        standardType: "DataTableComponent",
        props: { title: "Contacts" },
        bindings: {},
      },
    };

    render(<TemplatePropertyEditor object={instance} objects={[page, collection, instance]} relations={[]} busy={false} onRename={vi.fn()} onSaveDefinition={onSaveDefinition} onSaveScreenPages={vi.fn()} />);

    const title = screen.getByLabelText("Title") as HTMLInputElement;
    await user.clear(title);
    await user.type(title, "People");
    await user.click(screen.getByRole("button", { name: "Add" }));
    const bindingKey = screen.getByLabelText("Bindings key") as HTMLInputElement;
    await user.clear(bindingKey);
    await user.type(bindingKey, "rows");
    const bindingSource = screen.getByLabelText("Bindings source") as HTMLInputElement;
    await user.clear(bindingSource);
    await user.type(bindingSource, "contacts.rows");
    await user.click(screen.getByRole("button", { name: /Save properties/i }));

    expect(onSaveDefinition).toHaveBeenCalledOnce();
    expect(onSaveDefinition.mock.calls[0][0]).toMatchObject({
      props: { title: "People" },
      bindings: { rows: "contacts.rows" },
    });
  });

  it("assigns a Popup and creates a typed Open Popup menu action", async () => {
    const user = userEvent.setup();
    const onSaveScreenPages = vi.fn(async (
      _relations: Array<{ pageObjectId: string; sortOrder: number; isDefault: boolean }>,
      _definition: Record<string, unknown>,
    ) => undefined);
    const studioScreen = {
      id: "screen-row",
      objectType: "SCREEN",
      objectKey: "screen.main",
      objectName: "Main",
      editVersion: 1,
      definition: {
        defaultPageId: "page.contacts",
        regions: ["header", "left", "content", "right", "footer"].map((key) => ({ key, componentInstanceIds: [] })),
        menu: [],
        popupIds: [],
        eventSteps: [],
        css: "",
      },
    };
    const popup = {
      id: "popup-row",
      objectType: "POPUP",
      objectKey: "popup.info",
      objectName: "Info Popup",
      editVersion: 1,
      definition: { pageId: "page.contacts" },
    };
    const route = {
      id: "route-row",
      objectType: "ROUTE",
      objectKey: "route.home",
      objectName: "Home",
      editVersion: 1,
      definition: { path: "/", screenId: "screen.main", isDefault: true },
    };
    const relations = [{ screenObjectId: "screen-row", pageObjectId: "page-row", sortOrder: 0, isDefault: true }];

    render(<TemplatePropertyEditor object={studioScreen} objects={[studioScreen, page, collection, popup, route]} relations={relations} busy={false} onRename={vi.fn()} onSaveDefinition={vi.fn()} onSaveScreenPages={onSaveScreenPages} />);

    await user.click(screen.getByLabelText("Info Popup"));
    await user.click(screen.getByRole("button", { name: /Add menu/i }));
    await user.selectOptions(screen.getByLabelText("Action"), "open_popup");
    expect((screen.getByLabelText("Target") as HTMLSelectElement).value).toBe("popup.info");
    await user.click(screen.getByRole("button", { name: /Save Screen \+ Pages/i }));

    expect(onSaveScreenPages).toHaveBeenCalledOnce();
    expect(onSaveScreenPages.mock.calls[0][1]).toMatchObject({
      popupIds: ["popup.info"],
      menu: [expect.objectContaining({ action: { type: "open_popup", popupId: "popup.info" } })],
    });
  });

  it("reviews a publish diff and confirms the exact Draft version", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/publish") && method === "GET") {
        return new Response(JSON.stringify({
          review: {
            canPublish: true,
            issues: [],
            draft: { editVersion: 7, digest: "a".repeat(64) },
            published: { id: "revision-1", number: 1, digest: "b".repeat(64), sourceEditVersion: 3, publishedAt: "2026-09-12T00:00:00.000Z" },
            diff: {
              added: 1,
              changed: 1,
              removed: 0,
              changes: [
                { kind: "changed", objectType: "PAGE", objectKey: "page.contacts" },
                { kind: "added", objectType: "POPUP", objectKey: "popup.info" },
              ],
            },
          },
        }), { status: 200 });
      }
      if (url.endsWith("/publish") && method === "POST") {
        return new Response(JSON.stringify({ revision: { number: 2 } }), { status: 200 });
      }
      if (url.endsWith("/objects")) {
        return new Response(JSON.stringify({ objects: [] }), { status: 200 });
      }
      if (url.endsWith("/screen-pages")) {
        return new Response(JSON.stringify({ screenPages: [] }), { status: 200 });
      }
      if (url.endsWith("/api/templates/template-a")) {
        return new Response(JSON.stringify({ template: { id: "template-a", templateName: "Demo", templateSlug: "demo", isPublic: false, editVersion: 7, publishedRevisionId: "revision-1" } }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TemplateStudioClient templateId="template-a" />);
    await user.click(await screen.findByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("dialog", { name: "Publish review" })).toBeTruthy();
    expect(screen.getByText("PAGE")).toBeTruthy();
    expect(screen.getByText("page.contacts")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "ยืนยัน Publish" }));

    expect(await screen.findByText(/Published revision #2/)).toBeTruthy();
    const publishCall = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith("/publish") && init?.method === "POST",
    );
    expect(JSON.parse(String(publishCall?.[1]?.body))).toEqual({ expectedEditVersion: 7 });
  });
});
