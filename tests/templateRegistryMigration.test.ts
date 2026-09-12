import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../docker/postgres/migrations/027_create_customer_template_registry.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("P1 customer/template registry migration", () => {
  it.each([
    "customers",
    "customer_memberships",
    "templates",
    "template_objects",
    "template_screen_pages",
    "template_object_dependencies",
    "template_revisions",
  ])("creates the additive %s table", (table) => {
    expect(migration).toMatch(
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`),
    );
  });

  it("keeps Screen/Page references inside the same Template", () => {
    expect(migration).toContain("FOREIGN KEY (template_id, screen_object_id)");
    expect(migration).toContain("FOREIGN KEY (template_id, page_object_id)");
    expect(migration).toContain("validate_template_screen_page_types");
  });

  it("provides ownership and optimistic edit guards", () => {
    expect(migration).toContain("template_role_of(p_actor_user_id, p_template_id)");
    expect(migration).toContain("edit_version = p_expected_edit_version");
    expect(migration).toContain("template object edit conflict");
  });

  it("makes published revisions immutable and template-scoped", () => {
    expect(migration).toContain("template_revisions_immutable");
    expect(migration).toContain("template revisions are immutable");
    expect(migration).toContain("FOREIGN KEY (id, published_revision_id)");
    expect(migration).toContain("FOREIGN KEY (template_id, template_revision_id)");
  });

  it("does not remove legacy data structures", () => {
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.(platforms|apps)/i);
  });
});
