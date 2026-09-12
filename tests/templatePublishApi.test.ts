import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  requireApiSession: vi.fn(),
  requireTemplateAccess: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({
  getCoreDb: () => ({ connect: mocks.connect }),
}));

vi.mock("@/lib/auth/apiAuth", () => ({
  requireApiSession: mocks.requireApiSession,
  requireTemplateAccess: mocks.requireTemplateAccess,
}));

import { POST as publishTemplate } from "@/app/api/templates/[id]/publish/route";

const actor = {
  sub: "user-a",
  role: "TENANT_USER",
  actor: "user-a",
  mustChangePassword: false,
};

const compileRows = () => {
  const source = structuredClone(
    MINIMAL_TEMPLATE_DEFINITION,
  ) as TemplateDefinition;
  const rows = [
    ["STARTUP", "startup", "Startup", source.startup],
    ...source.routes.map((item) => ["ROUTE", item.id, item.id, item]),
    ...source.screens.map((item) => ["SCREEN", item.id, item.name, item]),
    ...source.pages.map((item) => ["PAGE", item.id, item.name, item]),
    ...source.componentInstances.map((item) => [
      "COMPONENT_INSTANCE",
      item.id,
      item.id,
      item,
    ]),
    ...source.collections.map((item) => ["COLLECTION", item.id, item.name, item]),
  ];
  return rows.map(([type, key, name, definition], index) => ({
    id: `object-${index}`,
    object_type: type,
    object_key: key,
    object_name: name,
    definition,
  }));
};

const createClient = (objects = compileRows()) => {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("customer_role_rank")) {
      return { rowCount: 1, rows: [{ role_rank: 1 }] };
    }
    if (sql.includes("FROM public.templates") && sql.includes("FOR UPDATE")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: "template.contacts",
            customer_id: "customer.demo",
            template_name: "Contacts",
            edit_version: "1",
          },
        ],
      };
    }
    if (sql.includes("FROM public.template_objects") && !sql.includes("JOIN")) {
      return { rowCount: objects.length, rows: objects };
    }
    if (sql.includes("FROM public.template_screen_pages")) {
      return {
        rowCount: 1,
        rows: [
          {
            screen_key: "screen.main",
            page_key: "page.contacts",
            sort_order: 0,
            is_default: true,
          },
        ],
      };
    }
    if (sql.includes("WHERE template_id = $1 AND revision_digest = $2")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes("COALESCE(MAX(revision_number)")) {
      return { rowCount: 1, rows: [{ revision_number: "1" }] };
    }
    if (sql.includes("INSERT INTO public.template_revisions")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: "revision-row-1",
            revision_number: "1",
            revision_digest: "a".repeat(64),
            schema_version: "1.0.0",
            source_edit_version: "1",
            published_at: new Date("2026-09-12T00:00:00Z"),
          },
        ],
      };
    }
    return { rowCount: null, rows: [] };
  });
  return { query, release: vi.fn() };
};

describe("Template publish API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue(actor);
    mocks.requireTemplateAccess.mockResolvedValue(null);
  });

  it("compiles, validates and stores one immutable revision transactionally", async () => {
    const client = createClient();
    mocks.connect.mockResolvedValue(client);

    const response = await publishTemplate(new Request("http://local", { method: "POST" }), {
      params: Promise.resolve({ id: "template.contacts" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.definition.template.revision).toMatch(/^[0-9a-f]{64}$/);
    expect(body.revision).toMatchObject({ number: 1, reused: false });
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain("BEGIN");
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain("COMMIT");
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO public.template_revisions"),
    )).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back and returns validation issues instead of publishing invalid Objects", async () => {
    const client = createClient(
      compileRows().filter((row) => row.object_type !== "STARTUP"),
    );
    mocks.connect.mockResolvedValue(client);

    const response = await publishTemplate(new Request("http://local", { method: "POST" }), {
      params: Promise.resolve({ id: "template.contacts" }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "startup_object_count" }),
      ]),
    });
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK");
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO public.template_revisions"),
    )).toBe(false);
  });

  it("does not open a transaction after the Template guard denies access", async () => {
    mocks.requireTemplateAccess.mockResolvedValue(
      NextResponse.json({ error: "denied" }, { status: 403 }),
    );

    const response = await publishTemplate(new Request("http://local", { method: "POST" }), {
      params: Promise.resolve({ id: "template-b" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
