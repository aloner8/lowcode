import { describe, expect, it } from "vitest";
import { createDefaultModuleConfig, validateModuleSetting } from "@/lib/modules/moduleSettings";

describe("Module Setting policy", () => {
  it("provides publishable defaults for local Auth and Files", () => {
    expect(validateModuleSetting({ moduleKey: "auth", enabled: true, config: createDefaultModuleConfig("auth") }).valid).toBe(true);
    expect(validateModuleSetting({ moduleKey: "files", enabled: true, config: createDefaultModuleConfig("files") }).valid).toBe(true);
    expect(validateModuleSetting({ moduleKey: "google", enabled: true, config: createDefaultModuleConfig("google") }).valid).toBe(true);
    expect(validateModuleSetting({ moduleKey: "media", enabled: true, config: createDefaultModuleConfig("media") }).valid).toBe(true);
  });

  it("accepts social Auth but rejects unknown providers and external redirects", () => {
    expect(validateModuleSetting({ moduleKey: "payments", enabled: true, config: {} }).issues)
      .toContainEqual(expect.objectContaining({ code: "unsupported_module" }));
    expect(validateModuleSetting({
      moduleKey: "auth",
      enabled: true,
      config: { providers: ["google", "saml"], allowRegister: true, afterLogin: "https://outside.example" },
    }).issues.map((item) => item.code)).toEqual(expect.arrayContaining([
      "unsupported_auth_provider",
      "invalid_after_login",
    ]));
    expect(validateModuleSetting({ moduleKey: "auth", enabled: true, config: { providers: ["local", "google"], allowRegister: true, afterLogin: "/dashboard" } }).valid).toBe(true);
  });

  it("rejects Files paths that could escape tenant scope", () => {
    expect(validateModuleSetting({ moduleKey: "files", enabled: true, config: { workingPath: "/documents/../private" } }).issues)
      .toContainEqual(expect.objectContaining({ code: "invalid_files_working_path" }));
  });
});
