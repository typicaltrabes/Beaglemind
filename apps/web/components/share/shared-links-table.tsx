'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReplayAuditLog } from './replay-audit-log';

interface ShareLink {
  id: string;
  runId: string;
  token: string;
  createdBy: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

function getStatus(link: ShareLink): 'active' | 'expired' | 'revoked' {
  if (link.revokedAt) return 'revoked';
  if (new Date(link.expiresAt) < new Date()) return 'expired';
  return 'active';
}

function StatusBadge({ status }: { status: 'active' | 'expired' | 'revoked' }) {
  const styles: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    expired: 'bg-yellow-500/20 text-yellow-400',
    revoked: 'bg-red-500/20 text-red-400',
  };

  return (
    <Badge className={styles[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SharedLinksTable() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/share-links');
      if (res.ok) {
        setLinks(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this share link? External viewers will immediately lose access.')) {
      return;
    }

    setRevoking(id);

    // Optimistically update the row
    setLinks((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, revokedAt: new Date().toISOString() } : l,
      ),
    );

    try {
      const res = await fetch(`/api/share-links/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        // Revert on failure
        fetchLinks();
      }
    } catch {
      fetchLinks();
    } finally {
      setRevoking(null);
    }
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Loading share links...
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No share links created yet. Share a replay from any completed run.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Run</th>
            <th className="pb-2 pr-4 font-medium">Created</th>
            <th className="pb-2 pr-4 font-medium">Expires</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const status = getStatus(link);
            const isExpanded = expandedId === link.id;

            return (
              <tr key={link.id} className="group">
                <td colSpan={5} className="p-0">
                  <div className="flex items-center border-b border-white/5 py-2">
                    <div className="flex-1 pr-4 font-mono text-xs text-foreground">
                      {link.runId.slice(0, 8)}...
                    </div>
                    <div className="w-24 pr-4 text-xs text-muted-foreground">
                      {relativeTime(link.createdAt)}
                    </div>
                    <div className="w-32 pr-4 text-xs text-muted-foreground">
                      {new Date(link.expiresAt).toLocaleDateString()}
                    </div>
                    <div className="w-24 pr-4">
                      <StatusBadge status={status} />
                    </div>
                    <div className="flex items-center gap-2">
                      {status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(link.id)}
                          disabled={revoking === link.id}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          {revoking === link.id ? 'Revoking...' : 'Revoke'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : link.id)
                        }
                        className="text-xs"
                      >
                        {isExpanded ? 'Hide log' : 'View log'}
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-b border-white/5 bg-white/[0.02] px-4 py-3">
                      <ReplayAuditLog shareLinkId={link.id} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
