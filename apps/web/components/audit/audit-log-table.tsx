'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

interface AuditRecord {
  id: string;
  operatorEmail: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

function getStatus(record: AuditRecord): {
  label: string;
  className: string;
} {
  if (record.revokedAt) {
    return { label: 'Revoked', className: 'border-red-500/50 text-red-400' };
  }
  if (new Date(record.expiresAt).getTime() > Date.now()) {
    return { label: 'Active', className: 'border-green-500/50 text-green-400' };
  }
  return { label: 'Expired', className: 'border-white/20 text-muted-foreground' };
}

export function AuditLogTable() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/audit-log')
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json();
          throw new Error(data.error || 'Failed to load');
        }
        return r.json();
      })
      .then((data) => setRecords(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading audit log...</p>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No operator access records.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Operator Email</th>
            <th className="px-4 py-3 font-medium">Reason</th>
            <th className="px-4 py-3 font-medium">Access Granted</th>
            <th className="px-4 py-3 font-medium">Access Expired</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const status = getStatus(record);
            return (
              <tr
                key={record.id}
                className="border-b border-white/5 transition-colors hover:bg-white/5"
              >
                <td className="px-4 py-3 text-foreground">
                  {record.operatorEmail}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                  {record.reason}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {new Date(record.grantedAt).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {new Date(record.expiresAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={status.className}>
                    {status.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
