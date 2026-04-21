import { requireTenantContext } from '@/lib/get-tenant';
import { LogoutButton } from './logout-button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantContext();

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <span className="text-lg font-semibold text-white">
          Beagle Agent Console
        </span>
        <LogoutButton />
      </header>
      <main>{children}</main>
    </div>
  );
}
