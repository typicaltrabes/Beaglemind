import { auth } from './auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, users } from '@beagle-console/db';
import { eq } from 'drizzle-orm';

/**
 * Check if current session user is an operator.
 * Returns true if user.isOperator is true.
 */
export async function isOperator(): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return false;
  const [user] = await db
    .select({ isOp: users.isOperator })
    .from(users)
    .where(eq(users.id, session.user.id));
  return user?.isOp === true;
}

/**
 * Gate function for operator-only routes.
 * Redirects to /login if no session, /dashboard if not operator.
 */
export async function requireOperator() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const [user] = await db
    .select({ isOp: users.isOperator })
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!user?.isOp) redirect('/dashboard');
  return { session, userId: session.user.id };
}
