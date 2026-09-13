import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiSession: vi.fn(),
  requireSiteAccess: vi.fn(),
  register: vi.fn(),
  apply: vi.fn(),
}));

vi.mock("@/lib/auth/apiAuth", () => ({
  requireApiSession: mocks.requireApiSession,
  requireSiteAccess: mocks.requireSiteAccess,
}));
vi.mock("@/lib/db/templateAppRevision", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/templateAppRevision")>(
    "@/lib/db/templateAppRevision",
  );
  return {
    ...actual,
    registerTemplateAppRevisionUpdate: mocks.register,
    applyTemplateAppRevisionUpdate: mocks.apply,
  };
});

import { POST } from "@/app/api/apps/[id]/revision/route";

const actor = {
  sub: "user-a",
  role: "TENANT_USER",
  actor: "user-a",
  mustChangePassword: false,
};

describe("App revision API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue(actor);
    mocks.requireSiteAccess.mockResolvedValue(null);
    mocks.register.mockResolvedValue({ appId: "app-a", operationId: "operation-a", reused: false });
    mocks.apply.mockResolvedValue({
      appId: "app-a",
      operationId: "operation-a",
      revisionId: "revision-2",
      revision: "b".repeat(64),
      reused: false,
    });
  });

  it("requires App ADMIN and executes the idempotent revision operation", async () => {
    const response = await POST(new Request("http://local", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "app-a-revision-2",
      },
      body: JSON.stringify({ revisionId: "revision-2" }),
    }), { params: Promise.resolve({ id: "app-a" }) });

    expect(response.status).toBe(200);
    expect(mocks.requireSiteAccess).toHaveBeenCalledWith(actor, "app-a", "ADMIN");
    expect(mocks.register).toHaveBeenCalledWith({
      actorId: "user-a",
      appId: "app-a",
      revisionId: "revision-2",
      operationKey: "app-a-revision-2",
    });
    expect(mocks.apply).toHaveBeenCalledWith("app-a", "operation-a");
  });

  it("does not register work when Site access is denied", async () => {
    mocks.requireSiteAccess.mockResolvedValue(
      NextResponse.json({ error: "denied" }, { status: 403 }),
    );

    const response = await POST(new Request("http://local", { method: "POST" }), {
      params: Promise.resolve({ id: "app-a" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
