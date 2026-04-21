'use client';

import { useState, useEffect } from 'react';

interface ReplayView {
  viewerIp: string;
  userAgent: string | null;
  viewedAt: string;
}

export function ReplayAuditLog({ shareLinkId }: { shareLinkId: string }) {
  const [views, setViews] = useState<ReplayView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchViews() {
      try {
        const res = await fetch(`/api/share-links/${shareLinkId}/views`);
        if (res.ok) {
          setViews(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }
    fetchViews();
  }, [shareLinkId]);

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Loading view log...
      </div>
    );
  }

  if (views.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No views yet
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/10 text-left text-muted-foreground">
          <th className="pb-2 pr-4 font-medium">Viewer IP</th>
          <th className="pb-2 pr-4 font-medium">User Agent</th>
          <th className="pb-2 font-medium">Viewed At</th>
        </tr>
      </thead>
      <tbody>
        {views.map((view, i) => (
          <tr key={i} className="border-b border-white/5">
            <td className="py-2 pr-4 font-mono text-xs text-foreground">
              {view.viewerIp}
            </td>
            <td
              className="max-w-[200px] truncate py-2 pr-4 text-xs text-muted-foreground"
              title={view.userAgent ?? ''}
            >
              {view.userAgent ?? 'Unknown'}
            </td>
            <td className="py-2 text-xs text-muted-foreground">
              {new Date(view.viewedAt).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
