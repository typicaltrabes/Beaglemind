import { requireOperator } from '@/lib/operator';
import { QueryProvider } from '@/components/providers/query-provider';
import Link from 'next/link';
import { LogoutButton } from '@/app/(dashboard)/logout-button';

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOperator();

  return (
    <QueryProvider>
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold text-white">
              Operator Console
            </span>
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-white"
            >
              Back to Dashboard
            </Link>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </QueryProvider>
  );
}
