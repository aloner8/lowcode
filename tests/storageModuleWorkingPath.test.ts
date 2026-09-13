import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import type { ServiceExecutionContext } from "@/lib/services/runtimeContext";
import type { TenantStorage } from "@/lib/storage/tenantStorage";

const mocks = vi.hoisted(() => ({ resolveTenantStorage: vi.fn() }));
vi.mock("@/lib/storage/tenantStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage/tenantStorage")>();
  return { ...actual, resolveTenantStorage: mocks.resolveTenantStorage };
});

import { executeStorageObjectService } from "@/lib/services/storageObjectService";

let temporaryRoot = "";
const ctx = {
  requestId: "request-a",
  traceId: "trace-a",
  actor: { type: "tenant-user", userId: "member-a", roles: ["member"], permissions: [] },
  scope: { platformId: "platform-a", appId: "app-a", tenantId: "app-a", authRealm: "tenant" },
  slug: "records",
  publishedRevision: "revision-a",
  snapshot: {},
} satisfies ServiceExecutionContext;
const binding = {
  id: "files-default",
  name: "Local Files",
  kind: "storage" as const,
  enabled: true,
  serviceRef: { serviceKey: "storage.object", version: "1.0.0" },
  config: {
    rootNamespace: "shared",
    allowedMimeTypes: ["application/pdf"],
    maxFileBytes: 10485760,
    maxFilesPerRequest: 5,
    visibility: "private",
  },
  containerBindings: [],
};

describe("local Files working path", () => {
  beforeAll(async () => { temporaryRoot = await mkdtemp(path.join(tmpdir(), "lowcode-files-test-")); });
  afterAll(async () => { if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true }); });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTenantStorage.mockResolvedValue({
      writeRoot: temporaryRoot,
      readRoots: [temporaryRoot],
      tenantDbName: "app_records",
      publicUrl: (relative: string) => `/files/${relative}`,
    } satisfies TenantStorage);
  });

  it("uploads into the configured folder and lists the same stored object", async () => {
    const uploaded = await executeStorageObjectService(ctx, binding, "upload", {
      path: "/documents",
      files: [{ name: "record.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-1.4 test") }],
    });
    const assetId = uploaded.files?.[0]?.assetId;
    expect(assetId).toMatch(/^shared\/documents\/[a-f0-9]{12}-record\.pdf$/);
    if (!assetId) throw new Error("Upload did not return an assetId");
    await expect(readFile(path.join(temporaryRoot, assetId), "utf8"))
      .resolves.toBe("%PDF-1.4 test");

    const listed = await executeStorageObjectService(ctx, binding, "list", { path: "/documents" });
    expect(listed.files).toContainEqual(expect.objectContaining({ assetId }));
  });
});
