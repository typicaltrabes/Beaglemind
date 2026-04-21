import { requireTenantContext } from '@/lib/get-tenant';
import { QueryProvider } from '@/components/providers/query-provider';
import { Sidebar } from '@/components/sidebar/sidebar';
import { LogoutButton } from './logout-button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantContext();

  return (
    <QueryProvider>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <span className="text-lg font-semibold text-white">
              Beagle Agent Console
            </span>
            <LogoutButton />
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
