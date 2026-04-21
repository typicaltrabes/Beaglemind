import { requireOperator } from '@/lib/operator';
import { QueryProvider } from '@/components/providers/query-provider';

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOperator();

  return (
    <QueryProvider>
      <div className="min-h-screen bg-bg text-foreground">{children}</div>
    </QueryProvider>
  );
}
