import { describe, expect, it } from "vitest";
import {
  toPublicConnectionProfile,
  validateConnectionProfileInput,
  type ConnectionProfileRow,
} from "@/lib/connections/connectionProfiles";

const postgresInput = () => ({
  profileKey: "main.reporting",
  profileName: "Reporting database",
  profileType: "POSTGRES",
  config: {
    host: "db.internal",
    port: 5432,
    database: "reporting",
    sslMode: "require",
    poolMax: 8,
  },
  secretRefs: {
    username: "env://LOWCODE_CONNECTION_REPORTING_DB_USER",
    password: "env://LOWCODE_CONNECTION_REPORTING_DB_PASSWORD",
  },
  policy: {
    allowedModuleKeys: ["reports", "analytics", "reports"],
    allowRuntimeWrite: false,
  },
});

describe("Connection Profile policy", () => {
  it("normalizes a typed SecretRef-only profile", () => {
    const result = validateConnectionProfileInput(postgresInput());

    expect(result.valid, result.errors.join("\n")).toBe(true);
    expect(result.value).toMatchObject({
      profileKey: "main.reporting",
      profileType: "POSTGRES",
      policy: { allowedModuleKeys: ["analytics", "reports"], allowRuntimeWrite: false },
    });
  });

  it("rejects plaintext secrets and connection strings in config", () => {
    const input = postgresInput();
    Object.assign(input.config, {
      password: "do-not-store-this",
      connectionString: "postgres://someone:plaintext@db.internal/reporting",
    });

    const result = validateConnectionProfileInput(input);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("config.password"),
      expect.stringContaining("config.connectionString"),
    ]));
  });

  it("requires supported SecretRefs and type-specific config", () => {
    const input = postgresInput();
    input.secretRefs.password = "plaintext-password";
    input.config.poolMax = 200;

    const result = validateConnectionProfileInput(input);

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("poolMax"),
      expect.stringContaining("unsupported format"),
    ]));
  });

  it("cannot reference arbitrary process environment variables", () => {
    const input = postgresInput();
    input.secretRefs.password = "env://CORE_DATABASE_URL";

    const result = validateConnectionProfileInput(input);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Secret reference 'password' has an unsupported format");
  });

  it("never serializes SecretRef values to the browser DTO", () => {
    const now = new Date("2026-09-13T00:00:00.000Z");
    const row: ConnectionProfileRow = {
      id: "profile-a",
      customer_id: "customer-a",
      profile_key: "main.reporting",
      profile_name: "Reporting database",
      profile_type: "POSTGRES",
      config: postgresInput().config,
      secret_refs: postgresInput().secretRefs,
      policy: { allowedModuleKeys: ["reports"], allowRuntimeWrite: false },
      status: "DRAFT",
      edit_version: "1",
      last_checked_at: null,
      last_error_code: null,
      created_at: now,
      updated_at: now,
    };

    const dto = toPublicConnectionProfile(row, () => ({ configured: true, provider: "environment" }));

    expect(dto.secretReferences).toEqual([
      { key: "password", configured: true, provider: "environment" },
      { key: "username", configured: true, provider: "environment" },
    ]);
    expect(JSON.stringify(dto)).not.toContain("LOWCODE_CONNECTION_REPORTING_DB_PASSWORD");
    expect(JSON.stringify(dto)).not.toContain("env://");
  });
});
