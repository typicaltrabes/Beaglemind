'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Tenant {
  id: string;
  name: string;
}

export function BreakGlassForm({ onSuccess }: { onSuccess: () => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ expiresAt: string } | null>(null);

  useEffect(() => {
    // Fetch tenants from the break-glass list endpoint (uses shared.tenants)
    fetch('/api/operator/tenants')
      .then((r) => r.json())
      .then((data) => setTenants(data))
      .catch(() => setTenants([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedTenant) {
      setError('Select a tenant');
      return;
    }
    if (reason.length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/operator/break-glass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedTenant, reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Request failed');
        return;
      }

      const data = await res.json();
      setSuccess({ expiresAt: data.expiresAt });
      setReason('');
      setSelectedTenant('');
      onSuccess();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-amber-400">
          Tenant
        </label>
        <select
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
          className="w-full rounded-md border border-amber-500/30 bg-black/40 px-3 py-2 text-sm text-foreground focus:border-amber-500 focus:outline-none"
        >
          <option value="">Select a tenant...</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-amber-400">
          Reason
        </label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe why you need access to this tenant's data"
          className="min-h-[80px] border-amber-500/30 bg-black/40 focus:border-amber-500"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Minimum 10 characters. This will be visible in the tenant's audit log.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Break-glass access granted. Expires at{' '}
          {new Date(success.expiresAt).toLocaleString()}.
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="border border-amber-500/50 bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
      >
        {loading ? 'Requesting...' : 'Request Break-Glass Access'}
      </Button>
    </form>
  );
}
