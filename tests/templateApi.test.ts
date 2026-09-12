import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireApiSession: vi.fn(),
  requireCustomerAccess: vi.fn(),
  requireTemplateAccess: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ query: mocks.query }),
}));

vi.mock("@/lib/auth/apiAuth", () => ({
  isGod: (role: string) => role === "GOD",
  requireApiSession: mocks.requireApiSession,
  requireCustomerAccess: mocks.requireCustomerAccess,
  requireTemplateAccess: mocks.requireTemplateAccess,
}));

import { GET as listTemplates } from "@/app/api/templates/route";
import {
  GET as getTemplate,
  PATCH as patchTemplate,
} from "@/app/api/templates/[id]/route";
import { POST as saveObject } from "@/app/api/templates/[id]/objects/route";

const actor = {
  sub: "user-a",
  role: "TENANT_USER",
  actor: "user-a",
  mustChangePassword: false,
};

const templateRow = {
  id: "template-a",
  customer_id: "customer-a",
  template_slug: "contacts",
  template_name: "Contacts",
  description: null,
  is_public: false,
  edit_version: "2",
  published_revision_id: null,
  legacy_platform_id: null,
  created_at: new Date("2026-09-12T00:00:00Z"),
  updated_at: new Date("2026-09-12T00:00:00Z"),
};

describe("template API ownership and optimistic editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue(actor);
    mocks.requireCustomerAccess.mockResolvedValue(null);
    mocks.requireTemplateAccess.mockResolvedValue(null);
  });

  it("scopes a Customer user's template list through memberships", async () => {
    mocks.query.mockResolvedValue({ rowCount: 0, rows: [] });

    const response = await listTemplates(new Request("http://local/api/templates"));

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[0][0]).toContain("customer_memberships");
    expect(mocks.query.mock.calls[0][1]).toEqual(["user-a", null]);
  });

  it("does not query a Template after another Customer is denied", async () => {
    mocks.requireTemplateAccess.mockResolvedValue(
      NextResponse.json({ error: "denied" }, { status: 403 }),
    );

    const response = await getTemplate(new Request("http://local"), {
      params: Promise.resolve({ id: "template-b" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.requireTemplateAccess).toHaveBeenCalledWith(
      actor,
      "template-b",
      "VIEWER",
    );
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns a conflict when the expected edit version is stale", async () => {
    mocks.query.mockResolvedValue({ rowCount: 0, rows: [] });
    const response = await patchTemplate(
      new Request("http://local", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedEditVersion: 1, templateName: "Changed" }),
      }),
      { params: Promise.resolve({ id: "template-a" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "EDIT_CONFLICT" });
    expect(mocks.query.mock.calls[0][0]).toContain("edit_version = $2");
  });

  it("saves an Object through the guarded optimistic DB function", async () => {
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          id: "object-a",
          template_id: "template-a",
          object_type: "PAGE",
          object_key: "page.home",
          object_name: "Home",
          edit_version: "1",
          definition: {},
          created_at: templateRow.created_at,
          updated_at: templateRow.updated_at,
        },
      ],
    });

    const response = await saveObject(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objectType: "PAGE",
          objectKey: "page.home",
          objectName: "Home",
          definition: {},
          expectedEditVersion: 0,
        }),
      }),
      { params: Promise.resolve({ id: "template-a" }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.requireTemplateAccess).toHaveBeenCalledWith(
      actor,
      "template-a",
      "EDITOR",
    );
    expect(mocks.query.mock.calls[0][0]).toContain("save_template_object");
  });
});
