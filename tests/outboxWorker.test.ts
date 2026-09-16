import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const deliverSmtpMail = vi.fn();

vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ query }) }));
vi.mock("@/lib/services/smtpTransport", () => ({ deliverSmtpMail }));

const smtpJob = {
  id: "job-a",
  attempts: 1,
  max_attempts: 5,
  config_snapshot: {
    transport: "smtp", host: "smtp.test", port: 25, tlsMode: "none",
    rejectUnauthorized: true, connectionTimeoutMs: 1000, socketTimeoutMs: 5000,
    authMode: "none",
  },
  secret_refs: {},
  payload: {
    fromAddress: "noreply@example.test", to: ["user@example.test"], cc: [],
    subject: "Ready", html: "<p>Ready</p>", attachments: [],
  },
};

describe("mail outbox worker", () => {
  beforeEach(() => {
    query.mockReset();
    deliverSmtpMail.mockReset();
  });

  it("claims expired leases and records SMTP acceptance", async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [smtpJob] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    deliverSmtpMail.mockResolvedValue({ messageId: "message-a", accepted: ["user@example.test"], rejected: [] });
    const { processEmailOutbox } = await import("@/lib/services/outboxWorker");
    await expect(processEmailOutbox()).resolves.toEqual({ processed: 1, delivered: 1, failed: 0 });
    expect(query.mock.calls[0][0]).toContain("lease_expires_at<=now()");
    expect(query.mock.calls[1][0]).toContain("status='accepted'");
  });

  it("marks an ambiguous SMTP disconnect unknown instead of sending it again", async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [smtpJob] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    deliverSmtpMail.mockRejectedValue(Object.assign(new Error("socket closed"), { code: "ECONNRESET" }));
    const { processEmailOutbox } = await import("@/lib/services/outboxWorker");
    await expect(processEmailOutbox()).resolves.toEqual({ processed: 1, delivered: 0, failed: 1 });
    expect(query.mock.calls[1][0]).toContain("'unknown'");
    expect(query.mock.calls[1][1][4]).toBe(true);
  });
});

