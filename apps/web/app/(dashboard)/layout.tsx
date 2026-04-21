import { requireTenantContext } from '@/lib/get-tenant';
import { QueryProvider } from '@/components/providers/query-provider';
import { DashboardShell } from './dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantContext();

  return (
    <QueryProvider>
      <DashboardShell>{children}</DashboardShell>
    </QueryProvider>
  );
}
