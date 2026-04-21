'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Clock } from 'lucide-react';
import { BreakGlassForm } from '@/components/operator/break-glass-form';
import { BreakGlassRunViewer } from '@/components/operator/break-glass-run-viewer';

interface ActiveSession {
  tenantId: string;
  tenantName: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
}

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

export default function BreakGlassPage() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [viewingTenant, setViewingTenant] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    fetch('/api/operator/break-glass')
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    loadSessions();
    // Refresh every 60s to update time remaining
    const interval = setInterval(loadSessions, 60_000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Shield className="size-6 text-amber-500" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Break-Glass Access
          </h1>
          <p className="text-sm text-muted-foreground">
            Request time-boxed access to tenant data for debugging and support
          </p>
        </div>
      </div>

      {/* Request form */}
      <div className="mb-8 rounded-lg border border-amber-500/20 bg-amber-500/5 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-amber-400">
          New Request
        </h2>
        <BreakGlassForm onSuccess={loadSessions} />
      </div>

      {/* Active sessions */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active Sessions
        </h2>

        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No active break-glass sessions.
          </p>
        )}

        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={`${s.tenantId}-${s.grantedAt}`}
              className="rounded-md border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  {s.tenantName}
                </h3>
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <Clock className="size-3" />
                  {timeRemaining(s.expiresAt)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
              <div className="mt-3 flex gap-2">
                {viewingTenant === s.tenantId ? (
                  <button
                    onClick={() => setViewingTenant(null)}
                    className="text-xs text-amber-400 underline"
                  >
                    Hide Runs
                  </button>
                ) : (
                  <button
                    onClick={() => setViewingTenant(s.tenantId)}
                    className="text-xs text-amber-400 underline"
                  >
                    View Runs
                  </button>
                )}
              </div>
              {viewingTenant === s.tenantId && (
                <div className="mt-4 border-t border-white/5 pt-4">
                  <BreakGlassRunViewer tenantId={s.tenantId} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
