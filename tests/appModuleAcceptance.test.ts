import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceExecutionContext, ServiceActor } from "@/lib/services/runtimeContext";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  executeStorageObjectService: vi.fn(),
}));
vi.mock("@/lib/db/coreDb", () => ({ getCoreDb: () => ({ query: mocks.query }) }));
vi.mock("@/lib/services/storageObjectService", () => ({
  executeStorageObjectService: mocks.executeStorageObjectService,
}));

import { dispatchModule } from "@/lib/services/moduleFacade";

const tenantActor = (permissions: string[] = []): ServiceActor => ({
  type: "tenant-user",
  userId: "member-a",
  roles: ["member"],
  permissions,
});

const appContext = (actor: ServiceActor): ServiceExecutionContext => ({
  requestId: "request-a",
  traceId: "trace-a",
  actor,
  scope: { platformId: "platform-a", appId: "app-a", tenantId: "app-a", authRealm: "tenant" },
  slug: "records",
  publishedRevision: "revision-a",
  snapshot: {
    templateModules: [
      { moduleKey: "auth", enabled: true, config: { providers: ["local"], allowRegister: false, afterLogin: "/" } },
      { moduleKey: "files", enabled: true, config: { workingPath: "/documents" } },
    ],
    services: [
      {
        id: "auth-default",
        name: "Local Auth",
        kind: "auth",
        enabled: true,
        serviceRef: { serviceKey: "auth.session", version: "1.0.0" },
        config: { accessTokenTtlSeconds: 900 },
        policy: { allowedOperations: ["me"] },
        containerBindings: [],
      },
      {
        id: "files-default",
        name: "Local Files",
        kind: "storage",
        enabled: true,
        serviceRef: { serviceKey: "storage.object", version: "1.0.0" },
        config: { rootNamespace: "shared", allowedMimeTypes: ["application/pdf"], maxFileBytes: 10485760 },
        policy: {
          allowedOperations: ["list", "delete"],
          requiredPermissions: { delete: ["storage.delete"] },
        },
        containerBindings: [],
      },
    ],
  },
});

describe("P5 App local Auth/Files acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [] });
    mocks.executeStorageObjectService.mockImplementation(async (_ctx, _binding, operation, input) =>
      operation === "list" ? { rootPath: input.path, files: [] } : { deleted: true },
    );
  });

  it("returns the authenticated App tenant actor through local Auth", async () => {
    const ctx = appContext(tenantActor(["profile.read"]));
    const response = await dispatchModule(ctx, "auth", "me", {});
    expect(response.result.data).toMatchObject({
      user: { type: "tenant-user", userId: "member-a", permissions: ["profile.read"] },
    });
    expect(response.serviceKey).toBe("auth.session");
  });

  it("runs local Files with the revision default for an authenticated tenant", async () => {
    const ctx = appContext(tenantActor());
    const response = await dispatchModule(ctx, "files", "list", {});
    expect(response.result.data).toEqual({ rootPath: "/documents", files: [] });
    expect(mocks.executeStorageObjectService).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ id: "files-default" }),
      "list",
      { path: "/documents" },
    );
  });

  it("denies anonymous Files access and tenant operations without permission", async () => {
    await expect(dispatchModule(appContext({ type: "anonymous", roles: [], permissions: [] }), "files", "list", {}))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(dispatchModule(appContext(tenantActor()), "files", "delete", { assetId: "shared/file.pdf" }))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(mocks.executeStorageObjectService).not.toHaveBeenCalled();
  });

  it("allows the same Files operation when the App tenant permission is present", async () => {
    const ctx = appContext(tenantActor(["storage.delete"]));
    await expect(dispatchModule(ctx, "files", "delete", { assetId: "shared/file.pdf" }))
      .resolves.toMatchObject({ result: { data: { deleted: true } } });
    expect(mocks.executeStorageObjectService).toHaveBeenCalledOnce();
  });
});
