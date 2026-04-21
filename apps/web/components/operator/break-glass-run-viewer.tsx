'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Run {
  id: string;
  projectName: string | null;
  status: string;
  prompt: string | null;
  createdAt: string;
}

interface RunEvent {
  id: number;
  sequenceNumber: number;
  type: string;
  agentId: string;
  content: unknown;
  createdAt: string;
}

const AGENT_COLORS: Record<string, string> = {
  mo: 'text-amber-500',
  jarvis: 'text-teal-500',
  user: 'text-blue-400',
};

export function BreakGlassRunViewer({ tenantId }: { tenantId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [runDetail, setRunDetail] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/operator/break-glass/${tenantId}/runs`)
      .then(async (r) => {
        if (r.status === 403) {
          setError('Break-glass session expired');
          return [];
        }
        if (!r.ok) throw new Error('Failed to fetch runs');
        return r.json();
      })
      .then((data) => setRuns(data))
      .catch(() => setError('Failed to load runs'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  async function loadRunEvents(runId: string) {
    setSelectedRun(runId);
    setError(null);
    try {
      const res = await fetch(
        `/api/operator/break-glass/${tenantId}/runs/${runId}`
      );
      if (res.status === 403) {
        setError('Break-glass session expired');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch run');
      const data = await res.json();
      setRunDetail(data.run);
      setEvents(data.events);
    } catch {
      setError('Failed to load run events');
    }
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading runs...</p>;
  }

  // Event detail view
  if (selectedRun && runDetail) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedRun(null);
            setRunDetail(null);
            setEvents([]);
          }}
          className="text-muted-foreground"
        >
          <ArrowLeft className="mr-1 size-4" />
          Back to runs
        </Button>

        <div className="rounded-md border border-white/10 bg-black/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">{runDetail.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(runDetail.createdAt).toLocaleString()}
            </span>
          </div>
          {runDetail.prompt && (
            <p className="text-sm text-foreground">{runDetail.prompt}</p>
          )}
        </div>

        <h4 className="text-sm font-medium text-muted-foreground">
          Events ({events.length})
        </h4>

        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-md border border-white/5 bg-black/10 px-3 py-2"
            >
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className={AGENT_COLORS[event.agentId] || 'text-gray-400'}>
                  {event.agentId}
                </span>
                <span className="text-muted-foreground">#{event.sequenceNumber}</span>
                <Badge variant="outline" className="text-[10px]">
                  {event.type}
                </Badge>
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-foreground/80">
                {typeof event.content === 'string'
                  ? event.content
                  : JSON.stringify(event.content, null, 2)}
              </pre>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground">No events for this run.</p>
          )}
        </div>
      </div>
    );
  }

  // Run list view
  return (
    <div className="space-y-2">
      {runs.length === 0 && (
        <p className="text-sm text-muted-foreground">No runs found for this tenant.</p>
      )}
      {runs.map((run) => (
        <button
          key={run.id}
          onClick={() => loadRunEvents(run.id)}
          className="w-full rounded-md border border-white/10 bg-black/20 px-4 py-3 text-left transition-colors hover:bg-white/5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {run.projectName || 'Untitled'}
            </span>
            <Badge variant="outline">{run.status}</Badge>
          </div>
          {run.prompt && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {run.prompt}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(run.createdAt).toLocaleString()}
          </p>
        </button>
      ))}
    </div>
  );
}
