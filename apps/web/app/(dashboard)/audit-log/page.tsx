import { Shield } from 'lucide-react';
import { AuditLogTable } from '@/components/audit/audit-log-table';

export default function AuditLogPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Operator Access Audit Log
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This log shows when operators accessed your organization's data.
          </p>
        </div>
      </div>

      <AuditLogTable />
    </div>
  );
}
