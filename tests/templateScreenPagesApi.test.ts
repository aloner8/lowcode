import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  requireApiSession: vi.fn(),
  requireTemplateAccess: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ connect: mocks.connect, query: mocks.query }),
}));
vi.mock("@/lib/auth/apiAuth", () => ({
  requireApiSession: mocks.requireApiSession,
  requireTemplateAccess: mocks.requireTemplateAccess,
}));

import { PUT } from "@/app/api/templates/[id]/screen-pages/route";

const actor = { sub: "user-a", role: "TENANT_USER", actor: "user-a" };

describe("Template Screen/Page API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue(actor);
    mocks.requireTemplateAccess.mockResolvedValue(null);
  });

  it("atomically replaces one Screen relation set with one default", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("customer_role_rank")) return { rowCount: 1, rows: [{ role_rank: 1 }] };
      if (sql.includes("FROM public.templates")) return { rowCount: 1, rows: [{ id: "template-a" }] };
      if (sql.includes("id = ANY")) {
        return {
          rowCount: 2,
          rows: [
            { id: "11111111-1111-4111-8111-111111111111", object_type: "SCREEN" },
            { id: "22222222-2222-4222-8222-222222222222", object_type: "PAGE" },
          ],
        };
      }
      if (sql.includes("SELECT relation.id")) return { rowCount: 0, rows: [] };
      return { rowCount: null, rows: [] };
    });
    mocks.connect.mockResolvedValue({ query, release: vi.fn() });

    const response = await PUT(
      new Request("http://local", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          screenObjectId: "11111111-1111-4111-8111-111111111111",
          expectedTemplateEditVersion: 3,
          pages: [{
            pageObjectId: "22222222-2222-4222-8222-222222222222",
            sortOrder: 0,
            isDefault: true,
          }],
        }),
      }),
      { params: Promise.resolve({ id: "template-a" }) },
    );

    expect(response.status).toBe(200);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("DELETE FROM"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO"))).toBe(true);
    expect(query.mock.calls.map(([sql]) => sql)).toContain("COMMIT");
  });

  it("rejects replacement without exactly one default before opening a transaction", async () => {
    const response = await PUT(
      new Request("http://local", {
        method: "PUT",
        body: JSON.stringify({
          screenObjectId: "screen-a",
          expectedTemplateEditVersion: 3,
          pages: [{ pageObjectId: "page-a", isDefault: false }],
        }),
      }),
      { params: Promise.resolve({ id: "template-a" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("does not connect when the outer ownership guard denies access", async () => {
    mocks.requireTemplateAccess.mockResolvedValue(
      NextResponse.json({ error: "denied" }, { status: 403 }),
    );
    const response = await PUT(
      new Request("http://local", { method: "PUT", body: "{}" }),
      { params: Promise.resolve({ id: "template-b" }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
