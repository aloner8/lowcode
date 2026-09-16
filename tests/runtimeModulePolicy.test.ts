import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceExecutionContext } from "@/lib/services/runtimeContext";

const mocks = vi.hoisted(() => ({ dispatchService: vi.fn() }));
vi.mock("@/lib/services/dispatcher", () => ({ dispatchService: mocks.dispatchService }));

import { dispatchModule } from "@/lib/services/moduleFacade";

const context = (templateModules: unknown[]): ServiceExecutionContext => ({
  requestId: "request-a",
  traceId: "trace-a",
  actor: { type: "tenant-user", userId: "user-a", roles: ["member"], permissions: [] },
  scope: { platformId: "platform-a", appId: "app-a", tenantId: "app-a", authRealm: "tenant" },
  slug: "app-a",
  publishedRevision: "revision-a",
  snapshot: {
    templateModules,
    services: [
      { id: "auth-default", enabled: true, serviceRef: { serviceKey: "auth.session", version: "1.0.0" }, config: {}, containerBindings: [] },
      { id: "files-default", enabled: true, serviceRef: { serviceKey: "storage.object", version: "1.0.0" }, config: {}, containerBindings: [] },
    ],
  },
});

describe("App runtime Module Setting policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dispatchService.mockResolvedValue({ data: { ok: true } });
  });

  it("dispatches an enabled module from the App's active revision", async () => {
    const ctx = context([{ moduleKey: "auth", enabled: true, config: { providers: ["local"], allowRegister: false, afterLogin: "/" } }]);
    await expect(dispatchModule(ctx, "auth", "me", {})).resolves.toMatchObject({ serviceKey: "auth.session" });
    expect(mocks.dispatchService).toHaveBeenCalledWith(ctx, "auth-default", "me", {}, undefined);
  });

  it("fails closed when a module is absent or disabled", async () => {
    await expect(dispatchModule(context([]), "auth", "me", {}))
      .rejects.toMatchObject({ code: "MODULE_NOT_CONFIGURED" });
    await expect(dispatchModule(context([{ moduleKey: "auth", enabled: false, config: {} }]), "auth", "me", {}))
      .rejects.toMatchObject({ code: "MODULE_DISABLED" });
    expect(mocks.dispatchService).not.toHaveBeenCalled();
  });

  it("applies the published Files working path when the caller omits one", async () => {
    const ctx = context([{ moduleKey: "files", enabled: true, config: { workingPath: "/documents" } }]);
    await dispatchModule(ctx, "files", "list", {});
    expect(mocks.dispatchService).toHaveBeenCalledWith(
      ctx,
      "files-default",
      "list",
      { path: "/documents" },
      undefined,
    );
  });

  it("applies the same published Files working path to uploads", async () => {
    const ctx = context([{ moduleKey: "files", enabled: true, config: { workingPath: "/documents" } }]);
    const files = [{ name: "record.pdf" }];
    await dispatchModule(ctx, "files", "upload", { files });
    expect(mocks.dispatchService).toHaveBeenCalledWith(
      ctx,
      "files-default",
      "upload",
      { files, path: "/documents" },
      undefined,
    );
  });

  it("rejects a runtime config that the current image cannot support", async () => {
    const ctx = context([{ moduleKey: "auth", enabled: true, config: { providers: ["saml"], allowRegister: false, afterLogin: "/" } }]);
    await expect(dispatchModule(ctx, "auth", "me", {}))
      .rejects.toMatchObject({ code: "MODULE_CONFIG_UNSUPPORTED" });
  });
});
