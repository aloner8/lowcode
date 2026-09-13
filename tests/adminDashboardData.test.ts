import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ query: mocks.query }) }));

import { loadDashboardCounts, loadDashboardSites } from "@/lib/admin/dashboardData";
import { fetchPlatformAudit } from "@/lib/engine/AuditLogService";

describe("P6 role-scoped Dashboard data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses App ownership/membership scope for tenant counts", async () => {
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ apps: "2", users: "5", platforms: "1", pages: "8", audit_logs: "13" }],
    });
    await expect(loadDashboardCounts("user-a", "agency-admin", false)).resolves.toEqual({
      apps: 2,
      users: 5,
      platforms: 1,
      pages: 8,
      auditLogs: 13,
    });
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("app.owner_user_id = $1");
    expect(sql).toContain("public.app_memberships");
    expect(sql).toContain("visible_platforms");
    expect(sql).toContain("audit.performed_by = $3");
    expect(params).toEqual(["user-a", false, "agency-admin"]);
  });

  it("passes the GOD visibility flag through the same deterministic query", async () => {
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [{}] });
    await loadDashboardCounts("god-a", "god", true);
    expect(mocks.query.mock.calls[0][1]).toEqual(["god-a", true, "god"]);
  });

  it("returns only scoped site rows and their visible platform IDs", async () => {
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [{
        id: "app-a",
        app_slug: "records",
        app_name: "Records",
        subdomain: "records.localhost",
        port: 33001,
        package_name: "standard",
        package_expires_at: new Date("2027-01-31T00:00:00.000Z"),
        is_active: true,
        is_suspended: false,
        primary_domain: "records.example.test",
        platform_id: "platform-a",
      }],
    });
    await expect(loadDashboardSites("user-a", false)).resolves.toEqual([
      expect.objectContaining({ appId: "app-a", primaryDomain: "records.example.test", platformId: "platform-a" }),
    ]);
    expect(mocks.query.mock.calls[0][0]).toContain("FROM visible_apps app");
    expect(mocks.query.mock.calls[0][1]).toEqual(["user-a", false]);
  });

  it("does not advertise the canonical hostname before domain readiness", async () => {
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [{
        id: "app-a", app_slug: "records", app_name: "Records",
        subdomain: "pending.example.test", port: 33001, package_name: "standard",
        package_expires_at: null, is_active: true, is_suspended: false,
        primary_domain: null, platform_id: null,
      }],
    });
    await expect(loadDashboardSites("user-a", false)).resolves.toEqual([
      expect.objectContaining({ primaryDomain: null }),
    ]);
  });

  it("scopes audit activity to visible platform IDs and skips empty scope", async () => {
    await expect(fetchPlatformAudit({ platformIds: [], limit: 6 })).resolves.toEqual({ logs: [], total: 0 });
    expect(mocks.query).not.toHaveBeenCalled();

    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await fetchPlatformAudit({ platformIds: ["platform-a"], performedBy: "agency-admin", limit: 6 });
    expect(mocks.query.mock.calls[0][0]).toContain("l.platform_id = ANY($1::uuid[])");
    expect(mocks.query.mock.calls[0][0]).toContain("l.performed_by = $2");
    expect(mocks.query.mock.calls[0][1]).toEqual([["platform-a"], "agency-admin"]);
    expect(mocks.query.mock.calls[1][1]).toEqual([["platform-a"], "agency-admin", 6, 0]);
  });
});
