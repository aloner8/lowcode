import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), fetchAudit: vi.fn() }));
vi.mock("@/lib/auth/apiAuth", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ query: mocks.query }) }));
vi.mock("@/lib/engine/AuditLogService", () => ({ fetchPlatformAudit: mocks.fetchAudit }));

import { GET } from "@/app/api/audit-logs/route";

describe("P6 audit log visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchAudit.mockResolvedValue({ logs: [], total: 0 });
  });

  it("applies App and Platform scope for tenant accounts", async () => {
    mocks.auth.mockResolvedValue({ sub: "user-a", role: "TENANT_USER", actor: "agency-admin" });
    mocks.query.mockResolvedValue({ rows: [{ app_ids: ["11111111-1111-4111-8111-111111111111"], platform_ids: ["22222222-2222-4222-8222-222222222222"] }] });
    const response = await GET(new Request("http://localhost/api/audit-logs?entityId=11111111-1111-4111-8111-111111111111&limit=10"));
    expect(response.status).toBe(200);
    expect(mocks.fetchAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityId: "11111111-1111-4111-8111-111111111111",
      scopeAppIds: ["11111111-1111-4111-8111-111111111111"],
      scopePlatformIds: ["22222222-2222-4222-8222-222222222222"], scopeActor: "agency-admin", limit: 10,
    }));
  });

  it("rejects malformed entity filters before querying", async () => {
    mocks.auth.mockResolvedValue({ sub: "god-a", role: "GOD" });
    const response = await GET(new Request("http://localhost/api/audit-logs?entityId=not-a-uuid"));
    expect(response.status).toBe(400);
    expect(mocks.fetchAudit).not.toHaveBeenCalled();
  });

  it("keeps GOD access global", async () => {
    mocks.auth.mockResolvedValue({ sub: "god-a", role: "GOD" });
    await GET(new Request("http://localhost/api/audit-logs"));
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.fetchAudit).toHaveBeenCalledWith(expect.not.objectContaining({ scopeAppIds: expect.anything() }));
  });
});
