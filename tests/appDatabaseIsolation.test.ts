import { describe, expect, it } from "vitest";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { MINIMAL_TEMPLATE_DEFINITION } from "@/lib/template/examples/minimalTemplate";

const integrationUrl = process.env.APP_PROVISION_TEST_DATABASE_URL;

describe("two App database isolation", () => {
  it.runIf(Boolean(integrationUrl))(
    "provisions the same revision into two DBs and keeps rows separate",
    async () => {
      process.env.CORE_DATABASE_URL = integrationUrl;
      const { getCoreDb } = await import("@/lib/db/coreDb");
      const {
        closeTenantDbPool,
        openTenantDbByName,
        provisionTenantDatabase,
      } = await import("@/lib/db/tenantDb");
      const { applyAppSchema } = await import("@/lib/db/appSchema");

      const suffix = Date.now().toString(36);
      const databaseA = `app_db_isolation_a_${suffix}`;
      const databaseB = `app_db_isolation_b_${suffix}`;
      const definition = structuredClone(
        MINIMAL_TEMPLATE_DEFINITION,
      ) as TemplateDefinition;
      definition.template.status = "published";
      definition.template.revision = "d".repeat(64);

      const appA = await provisionTenantDatabase(databaseA);
      const appB = await provisionTenantDatabase(databaseB);
      try {
        await applyAppSchema(appA.pool, definition);
        await applyAppSchema(appB.pool, definition);
        await appA.pool.query('INSERT INTO public.contacts (name) VALUES ($1)', [
          "Only App A",
        ]);
        await appB.pool.query('INSERT INTO public.contacts (name) VALUES ($1)', [
          "Only App B",
        ]);

        await appA.pool.query(
          'UPDATE public.contacts SET name = $1 WHERE name = $2',
          ["Updated App A", "Only App A"],
        );

        // Simulate a runtime restart: dispose the cached connection pool, then
        // open the already-provisioned database without recreating it.
        await closeTenantDbPool(databaseA);
        const restartedA = await openTenantDbByName(databaseA);

        const rowsA = await restartedA.query<{ name: string }>(
          "SELECT name FROM public.contacts ORDER BY id",
        );
        const rowsB = await appB.pool.query<{ name: string }>(
          "SELECT name FROM public.contacts ORDER BY id",
        );
        expect(rowsA.rows).toEqual([{ name: "Updated App A" }]);
        expect(rowsB.rows).toEqual([{ name: "Only App B" }]);
      } finally {
        await closeTenantDbPool(databaseA);
        await closeTenantDbPool(databaseB);
        const core = getCoreDb();
        for (const database of [databaseA, databaseB]) {
          await core.query(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
            [database],
          );
          await core.query(`DROP DATABASE "${database}"`);
        }
        await core.end();
        global.__lowcodeCoreDbPool = undefined;
      }
    },
    30_000,
  );
});
