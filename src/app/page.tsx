import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/authActions';

export const dynamic = 'force-dynamic';

/**
 * Control-plane root.
 *
 * This is an internal console with one audience — staff — so the root has no
 * content of its own and simply takes people where they are going. It replaces
 * a build-status landing page that advertised developer demos and linked to a
 * tenant app that no longer exists.
 */
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? '/admin' : '/login');
}
