import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireGod: vi.fn(),
  signSession: vi.fn(),
  verifySession: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ query: mocks.query }) }));
vi.mock("@/lib/auth/apiAuth", () => ({ requireGod: mocks.requireGod }));
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "platform_session",
  sessionCookieOptionsFor: () => ({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 28800, secure: false }),
  signSession: mocks.signSession,
  verifySession: mocks.verifySession,
}));
vi.mock("@/lib/engine/AuditLogService", () => ({ recordPlatformAudit: mocks.audit }));

import { POST as startImpersonation } from "@/app/api/admin/impersonation/route";
import { POST as stopImpersonation } from "@/app/api/admin/impersonation/stop/route";

const god = {
  sub: "11111111-1111-1111-1111-111111111111", username: "god", email: "god@example.test",
  fullName: "God Admin", role: "GOD", mustChangePassword: false, actor: "god", iat: 1, exp: 2,
};

describe("P6 GOD impersonation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signSession.mockResolvedValue("signed-token");
    mocks.audit.mockResolvedValue(true);
  });

  it("starts an auditable tenant session while retaining the original GOD", async () => {
    mocks.requireGod.mockResolvedValue(god);
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [{
      id: "22222222-2222-2222-2222-222222222222", username: "tenant", email: "tenant@example.test",
      full_name: "Tenant User", must_change_password: false,
    }] });
    const request = new NextRequest("http://localhost/api/admin/impersonation", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "targetUserId=22222222-2222-2222-2222-222222222222",
    });
    const response = await startImpersonation(request);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/admin");
    expect(mocks.query.mock.calls[0][0]).toContain("customer.status IN ('SUSPENDED', 'ARCHIVED')");
    expect(mocks.signSession).toHaveBeenCalledWith(expect.objectContaining({
      sub: "22222222-2222-2222-2222-222222222222", role: "TENANT_USER",
      impersonator: expect.objectContaining({ sub: god.sub, username: "god" }),
    }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "START_IMPERSONATION" }));
  });

  it("rejects a target that is not an active tenant", async () => {
    mocks.requireGod.mockResolvedValue(god);
    mocks.query.mockResolvedValue({ rowCount: 0, rows: [] });
    const request = new NextRequest("http://localhost/api/admin/impersonation", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "targetUserId=missing",
    });
    expect((await startImpersonation(request)).status).toBe(404);
    expect(mocks.signSession).not.toHaveBeenCalled();
  });

  it("revalidates and restores the original active GOD account", async () => {
    mocks.verifySession.mockResolvedValue({
      ...god, sub: "22222222-2222-2222-2222-222222222222", username: "tenant", role: "TENANT_USER",
      impersonator: { sub: god.sub, username: god.username, email: god.email, fullName: god.fullName },
    });
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [{
      id: god.sub, username: god.username, email: god.email, full_name: god.fullName, must_change_password: false,
    }] });
    const request = new NextRequest("http://localhost/api/admin/impersonation/stop", {
      method: "POST", headers: { cookie: "platform_session=current" },
    });
    const response = await stopImpersonation(request);
    expect(response.status).toBe(303);
    expect(mocks.query.mock.calls[0][0]).toContain("global_role = 'GOD'");
    expect(mocks.signSession).toHaveBeenCalledWith(expect.objectContaining({ sub: god.sub, role: "GOD" }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "END_IMPERSONATION" }));
  });

  it("refuses return when there is no signed impersonation context", async () => {
    mocks.verifySession.mockResolvedValue({ ...god, role: "TENANT_USER" });
    const response = await stopImpersonation(new NextRequest("http://localhost/api/admin/impersonation/stop", { method: "POST" }));
    expect(response.status).toBe(409);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("passes through GOD authorization failures", async () => {
    mocks.requireGod.mockResolvedValue(NextResponse.json({ error: "forbidden" }, { status: 403 }));
    const response = await startImpersonation(new NextRequest("http://localhost/api/admin/impersonation", { method: "POST" }));
    expect(response.status).toBe(403);
  });
});
