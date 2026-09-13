import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  return {
    client,
    connect: vi.fn(async () => client),
    requireApiSession: vi.fn(),
    requireTemplateAccess: vi.fn(),
  };
});

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ connect: mocks.connect }),
}));

vi.mock("@/lib/auth/apiAuth", () => ({
  requireApiSession: mocks.requireApiSession,
  requireTemplateAccess: mocks.requireTemplateAccess,
}));

import { DELETE, PUT } from "@/app/api/templates/[id]/objects/route";

const now = new Date("2026-09-13T00:00:00Z");
const row = (
  id: string,
  objectKey: string,
  loadOrder: number,
  placement: Record<string, unknown>,
) => ({
  id,
  template_id: "template-a",
  object_type: "COMPONENT_INSTANCE",
  object_key: objectKey,
  object_name: objectKey,
  edit_version: "1",
  definition: { ...placement, loadOrder, source: "standard", standardType: "TextComponent", props: {}, bindings: {} },
  created_at: now,
  updated_at: now,
});

const actor = {
  sub: "user-a",
  role: "TENANT_USER",
  actor: "user-a",
  mustChangePassword: false,
};

describe("template component placement API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue(actor);
    mocks.requireTemplateAccess.mockResolvedValue(null);
  });

  it("atomically persists the complete component order for one panel", async () => {
    const placement = { placement: "page_panel", pageId: "page.home", panelId: "main" };
    const first = row("00000000-0000-0000-0000-000000000001", "instance.first", 0, placement);
    const second = row("00000000-0000-0000-0000-000000000002", "instance.second", 1, placement);
    mocks.client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "template-a" }] })
      .mockResolvedValueOnce({ rowCount: 2, rows: [first, second] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...second, edit_version: "2", definition: { ...second.definition, loadOrder: 0 } }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...first, edit_version: "2", definition: { ...first.definition, loadOrder: 1 } }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({});

    const response = await PUT(new Request("http://local/api/templates/template-a/objects", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        placement,
        objects: [
          { objectId: second.id, expectedEditVersion: 1 },
          { objectId: first.id, expectedEditVersion: 1 },
        ],
      }),
    }), { params: Promise.resolve({ id: "template-a" }) });

    expect(response.status).toBe(200);
    expect(mocks.client.query.mock.calls[3][1]).toEqual(["template-a", second.id, 0, "user-a"]);
    expect(mocks.client.query.mock.calls[4][1]).toEqual(["template-a", first.id, 1, "user-a"]);
    expect(mocks.client.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(mocks.client.release).toHaveBeenCalledOnce();
  });

  it("removes a Screen instance and its authoritative region reference together", async () => {
    const placement = { placement: "screen_region", screenId: "screen.main", region: "header" };
    const instance = row("00000000-0000-0000-0000-000000000003", "instance.logo", 0, placement);
    const screen = {
      ...row("00000000-0000-0000-0000-000000000004", "screen.main", 0, {}),
      object_type: "SCREEN",
      object_name: "Main",
      definition: {
        regions: [
          { key: "header", componentInstanceIds: ["instance.logo", "instance.menu"] },
          { key: "content", componentInstanceIds: [] },
        ],
      },
    };
    mocks.client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "template-a" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [instance] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [screen] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({});

    const response = await DELETE(new Request("http://local/api/templates/template-a/objects", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objectId: instance.id, expectedEditVersion: 1 }),
    }), { params: Promise.resolve({ id: "template-a" }) });

    expect(response.status).toBe(204);
    const updatedScreen = JSON.parse(mocks.client.query.mock.calls[4][1][2]);
    expect(updatedScreen.regions[0].componentInstanceIds).toEqual(["instance.menu"]);
    expect(mocks.client.query.mock.calls[5][0]).toContain("DELETE FROM public.template_objects");
    expect(mocks.client.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });
});
