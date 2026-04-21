import { auth } from './auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function requireTenantContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  const tenantId = session.session.activeOrganizationId;
  if (!tenantId) {
    redirect('/no-org');
  }

  return { session, tenantId };
}
