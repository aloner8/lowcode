import { getCoreDb } from '@/lib/db/coreDb';
import type { GlobalRole } from '@/types';

export interface CustomerAccessBlock {
  customerId: string;
  customerName: string;
  status: 'SUSPENDED' | 'ARCHIVED';
}

/**
 * A suspended Customer blocks its tenant members from the control plane.
 * Apps are deliberately absent from this query: runtime suspension is a
 * separate operator decision and Customer suspension must not stop or delete it.
 */
export async function findCustomerAccessBlock(
  userId: string,
  role: GlobalRole,
): Promise<CustomerAccessBlock | null> {
  if (role === 'GOD') return null;
  const result = await getCoreDb().query<{
    id: string;
    customer_name: string;
    status: CustomerAccessBlock['status'];
  }>(`
    SELECT customer.id, customer.customer_name, customer.status
    FROM public.customer_memberships membership
    JOIN public.customers customer ON customer.id = membership.customer_id
    WHERE membership.user_id = $1 AND customer.status IN ('SUSPENDED', 'ARCHIVED')
    ORDER BY customer.status = 'SUSPENDED' DESC, customer.customer_name
    LIMIT 1
  `, [userId]);
  if (!result.rowCount) return null;
  return {
    customerId: result.rows[0].id,
    customerName: result.rows[0].customer_name,
    status: result.rows[0].status,
  };
}
