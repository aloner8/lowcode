import "server-only";
import { getCoreDb } from "@/lib/db/coreDb";

export interface CustomerSummary {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  primaryDomain: string | null;
  memberCount: number;
  templateCount: number;
  appCount: number;
}

export interface CustomerDetail extends CustomerSummary {
  quotas: Record<string, number>;
  createdAt: string;
  members: Array<{
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: "OWNER" | "EDITOR" | "VIEWER";
    canImpersonate: boolean;
  }>;
  templates: Array<{
    id: string;
    slug: string;
    name: string;
    isPublic: boolean;
    publishedRevisionId: string | null;
    appCount: number;
  }>;
  apps: Array<{
    id: string;
    slug: string;
    name: string;
    templateName: string;
    isActive: boolean;
    isSuspended: boolean;
    packageName: string;
  }>;
}

interface CustomerRow {
  id: string;
  customer_slug: string;
  customer_name: string;
  status: CustomerSummary["status"];
  primary_domain: string | null;
  quotas?: Record<string, number>;
  created_at?: Date;
  member_count: string;
  template_count: string;
  app_count: string;
}

const customerSelect = `
  SELECT customer.id, customer.customer_slug, customer.customer_name,
         customer.status, customer.primary_domain, customer.quotas,
         customer.created_at,
         COUNT(DISTINCT membership.id)::text AS member_count,
         COUNT(DISTINCT template.id)::text AS template_count,
         COUNT(DISTINCT app.id)::text AS app_count
  FROM public.customers customer
  LEFT JOIN public.customer_memberships membership ON membership.customer_id = customer.id
  LEFT JOIN public.templates template
    ON template.customer_id = customer.id AND template.archived_at IS NULL
  LEFT JOIN public.apps app ON app.template_id = template.id
`;

const mapSummary = (row: CustomerRow): CustomerSummary => ({
  id: row.id,
  slug: row.customer_slug,
  name: row.customer_name,
  status: row.status,
  primaryDomain: row.primary_domain,
  memberCount: Number(row.member_count),
  templateCount: Number(row.template_count),
  appCount: Number(row.app_count),
});

export async function loadCustomerSummaries(): Promise<CustomerSummary[]> {
  const result = await getCoreDb().query<CustomerRow>(`${customerSelect}
    GROUP BY customer.id
    ORDER BY customer.status = 'ACTIVE' DESC, customer.customer_name
  `);
  return result.rows.map(mapSummary);
}

export async function loadCustomerDetail(customerId: string): Promise<CustomerDetail | null> {
  const db = getCoreDb();
  const customerResult = await db.query<CustomerRow>(`${customerSelect}
    WHERE customer.id = $1
    GROUP BY customer.id
  `, [customerId]);
  if (!customerResult.rowCount) return null;

  const [memberResult, templateResult, appResult] = await Promise.all([
    db.query<{
      id: string; username: string; email: string; full_name: string | null;
      customer_role: CustomerDetail["members"][number]["role"];
      global_role: "GOD" | "TENANT_USER"; is_active: boolean; must_change_password: boolean;
    }>(`
      SELECT user_account.id, user_account.username, user_account.email,
             user_account.full_name, user_account.global_role, user_account.is_active,
             user_account.must_change_password, membership.customer_role
      FROM public.customer_memberships membership
      JOIN public.platform_users user_account ON user_account.id = membership.user_id
      WHERE membership.customer_id = $1
      ORDER BY CASE membership.customer_role WHEN 'OWNER' THEN 0 WHEN 'EDITOR' THEN 1 ELSE 2 END,
               user_account.full_name NULLS LAST, user_account.username
    `, [customerId]),
    db.query<{
      id: string; template_slug: string; template_name: string; is_public: boolean;
      published_revision_id: string | null; app_count: string;
    }>(`
      SELECT template.id, template.template_slug, template.template_name,
             template.is_public, template.published_revision_id,
             COUNT(app.id)::text AS app_count
      FROM public.templates template
      LEFT JOIN public.apps app ON app.template_id = template.id
      WHERE template.customer_id = $1 AND template.archived_at IS NULL
      GROUP BY template.id
      ORDER BY template.template_name
    `, [customerId]),
    db.query<{
      id: string; app_slug: string; app_name: string; template_name: string;
      is_active: boolean; is_suspended: boolean; package_name: string;
    }>(`
      SELECT app.id, app.app_slug, app.app_name, template.template_name,
             app.is_active, app.is_suspended, app.package_name
      FROM public.apps app
      JOIN public.templates template ON template.id = app.template_id
      WHERE template.customer_id = $1
      ORDER BY app.is_active DESC, app.app_name
    `, [customerId]),
  ]);

  const row = customerResult.rows[0];
  return {
    ...mapSummary(row),
    quotas: row.quotas ?? {},
    createdAt: row.created_at?.toISOString() ?? "",
    members: memberResult.rows.map((member) => ({
      id: member.id,
      username: member.username,
      email: member.email,
      fullName: member.full_name ?? member.username,
      role: member.customer_role,
      canImpersonate: row.status === "ACTIVE" && member.global_role === "TENANT_USER" && member.is_active && !member.must_change_password,
    })),
    templates: templateResult.rows.map((template) => ({
      id: template.id,
      slug: template.template_slug,
      name: template.template_name,
      isPublic: template.is_public,
      publishedRevisionId: template.published_revision_id,
      appCount: Number(template.app_count),
    })),
    apps: appResult.rows.map((app) => ({
      id: app.id,
      slug: app.app_slug,
      name: app.app_name,
      templateName: app.template_name,
      isActive: app.is_active,
      isSuspended: app.is_suspended,
      packageName: app.package_name,
    })),
  };
}
