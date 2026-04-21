import { requireTenantContext } from '@/lib/get-tenant';

export default async function DashboardPage() {
  await requireTenantContext();

  return (
    <div className="flex min-h-[calc(100vh-65px)] items-center justify-center">
      <p className="text-gray-400">Dashboard coming in Phase 4</p>
    </div>
  );
}
