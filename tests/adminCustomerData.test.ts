import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ query: mocks.query }) }));

import { loadCustomerDetail, loadCustomerSummaries } from "@/lib/admin/customerData";

const customerRow = {
  id: "customer-a", customer_slug: "agency-a", customer_name: "Agency A",
  status: "ACTIVE", primary_domain: "agency.example.test",
  quotas: { maxApps: 10 }, created_at: new Date("2026-01-01T00:00:00.000Z"),
  member_count: "2", template_count: "1", app_count: "3", running_app_count: "1",
};

describe("P6 GOD Customer data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads Customer summaries with ownership-derived App counts", async () => {
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [customerRow] });
    await expect(loadCustomerSummaries()).resolves.toEqual([
      expect.objectContaining({ id: "customer-a", memberCount: 2, templateCount: 1, appCount: 3, runningAppCount: 1 }),
    ]);
    expect(mocks.query.mock.calls[0][0]).toContain("app.template_id = template.id");
  });

  it("returns a complete Customer detail view", async () => {
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [customerRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "user-a", username: "owner", email: "owner@example.test", full_name: null, customer_role: "OWNER", global_role: "TENANT_USER", is_active: true, must_change_password: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "template-a", template_slug: "records", template_name: "Records", is_public: false, published_revision_id: "revision-a", app_count: "3" }] })
      .mockResolvedValueOnce({ rowCount: 2, rows: [
        { id: "app-a", app_slug: "records-a", app_name: "Records A", template_name: "Records", is_active: true, is_suspended: false, package_name: "Standard", desired_state: "RUNNING", observed_state: "RUNNING", runtime_metrics: { cpuPercent: 12.5, memoryRssBytes: 100 }, runtime_metrics_at: new Date("2026-09-13T10:00:00.000Z"), resource_metrics: { dbStorageBytes: 500, fileStorageBytes: 40 }, resource_metrics_at: new Date("2026-09-13T09:59:00.000Z") },
        { id: "app-b", app_slug: "records-b", app_name: "Records B", template_name: "Records", is_active: true, is_suspended: false, package_name: "Standard", desired_state: "STOPPED", observed_state: "STOPPED", resource_metrics: { fileStorageBytes: 60 }, resource_metrics_at: new Date("2026-09-13T09:58:00.000Z"), resource_metrics_error: "DB unavailable" },
      ] });

    await expect(loadCustomerDetail("customer-a")).resolves.toEqual(expect.objectContaining({
      id: "customer-a", quotas: { maxApps: 10 }, createdAt: "2026-01-01T00:00:00.000Z",
      members: [expect.objectContaining({ fullName: "owner", role: "OWNER", canImpersonate: true })],
      templates: [expect.objectContaining({ name: "Records", appCount: 3 })],
      apps: expect.arrayContaining([expect.objectContaining({ name: "Records A", templateName: "Records" })]),
      resources: {
        cpuPercent: expect.objectContaining({ value: 12.5, status: "AVAILABLE", availableSamples: 1, expectedSamples: 1 }),
        memoryRssBytes: expect.objectContaining({ value: 100, status: "AVAILABLE" }),
        dbStorageBytes: expect.objectContaining({ value: 500, status: "PARTIAL", availableSamples: 1, expectedSamples: 2 }),
        fileStorageBytes: expect.objectContaining({ value: 100, status: "AVAILABLE", measuredAt: "2026-09-13T09:58:00.000Z" }),
      },
    }));
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.query.mock.calls.every((call) => call[1]?.[0] === "customer-a")).toBe(true);
  });

  it("does not query child data when Customer is missing", async () => {
    mocks.query.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(loadCustomerDetail("missing")).resolves.toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
