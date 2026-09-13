import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../docker/postgres/migrations/029_create_connection_profiles.sql", import.meta.url),
  "utf8",
);

describe("P5-B3 connection profile migration", () => {
  it("adds a Customer-owned profile registry and App selector", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.connection_profiles");
    expect(migration).toContain("customer_id UUID NOT NULL REFERENCES public.customers");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS connection_profile_id UUID");
  });

  it("stores only metadata, policy, and SecretRefs", () => {
    expect(migration).toContain("secret_refs JSONB");
    expect(migration).toContain("connection_profiles_secret_refs_object");
    expect(migration).not.toMatch(/\b(password|access_token|connection_string)\s+(TEXT|VARCHAR|JSONB)/i);
  });

  it("is additive and does not rewrite existing Apps", () => {
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/UPDATE\s+public\.apps/i);
  });
});
