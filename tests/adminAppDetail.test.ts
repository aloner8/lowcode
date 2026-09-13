import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ query: mocks.query }) }));

import { loadAdminAppDetail } from "@/lib/admin/appAdminData";

describe("P6 App Detail data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the full visible App contract and recent operations", async () => {
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{
        id: "app-a", app_slug: "records-a", app_name: "Records A",
        tenant_db_name: "app_db_records_a", schema_revision: "schema-1", port: 34001,
        package_name: "Standard", is_active: true, is_suspended: false, can_control: true,
        desired_state: "RUNNING", observed_state: "RUNNING", runtime_error_detail: null,
        health_checked_at: new Date("2026-09-13T10:00:00.000Z"),
        runtime_metrics: { cpuPercent: 3, memoryRssBytes: 100 }, runtime_metrics_at: new Date("2026-09-13T10:00:00.000Z"),
        customer_id: "customer-a", customer_slug: "agency", customer_name: "Agency", quotas: { maxApps: 5, maxRunningApps: 2 },
        template_id: "template-a", template_slug: "records", template_name: "Records",
        revision_id: "revision-a", revision_number: "4", revision_digest: "a".repeat(64), app_count: "2", running_count: "1",
      }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ domain: "records.example.test", is_primary: true, is_active: true, readiness_status: "READY", verified_at: new Date("2026-09-13T09:00:00.000Z"), last_error: null }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "operation-a", operation_type: "START", status: "COMPLETED", checkpoint: "HEALTHY", error_detail: null, created_at: new Date("2026-09-13T09:59:00.000Z"), finished_at: new Date("2026-09-13T10:00:00.000Z") }] });

    await expect(loadAdminAppDetail("app-a", "user-a", false)).resolves.toEqual(expect.objectContaining({
      id: "app-a",
      canControl: true,
      revision: expect.objectContaining({ number: 4 }),
      quota: { apps: 2, maxApps: 5, running: 1, maxRunning: 2 },
      domains: [expect.objectContaining({ domain: "records.example.test", readiness: "READY" })],
      operations: [expect.objectContaining({ type: "START", checkpoint: "HEALTHY" })],
    }));
    expect(mocks.query.mock.calls[0][0]).toContain("visible_membership");
    expect(mocks.query.mock.calls[0][1]).toEqual(["app-a", "user-a", false]);
  });

  it("does not query related data when the App is outside the actor scope", async () => {
    mocks.query.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(loadAdminAppDetail("app-b", "user-a", false)).resolves.toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
