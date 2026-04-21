'use client';

import { useDigest } from '@/lib/hooks/use-digest';
import { Play, FileText, MessageCircle, AlertCircle, Coffee } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-600/20 text-green-400',
  executing: 'bg-amber-600/20 text-amber-400',
  cancelled: 'bg-red-600/20 text-red-400',
  planned: 'bg-blue-600/20 text-blue-400',
  pending: 'bg-gray-600/20 text-gray-400',
};

function RelativeTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  let label: string;
  if (diffMins < 60) {
    label = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    label = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    label = date.toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }

  return <span className="text-xs text-gray-500">{label}</span>;
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

export function DigestView() {
  const { data, isLoading, isError } = useDigest();

  if (isLoading) {
    return (
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
          While you were away
        </h2>
        <SkeletonCards />
      </section>
    );
  }

  if (isError || !data) {
    return null;
  }

  const isEmpty =
    data.runs.length === 0 &&
    data.artifacts.length === 0 &&
    data.answeredQuestions.length === 0 &&
    data.pendingCount === 0;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">
          While you were away
        </h2>
        <RelativeTime iso={data.since} />
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-card p-6 text-center">
          <Coffee className="size-8 text-gray-600" />
          <p className="text-sm text-gray-400">All quiet -- no activity since your last visit</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Pending questions callout */}
          {data.pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-600/10 p-3">
              <AlertCircle className="size-5 text-amber-400 shrink-0" />
              <span className="text-sm text-amber-300">
                {data.pendingCount} question{data.pendingCount !== 1 ? 's' : ''} still waiting
              </span>
            </div>
          )}

          {/* Runs that progressed */}
          {data.runs.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Play className="size-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-400">
                  {data.runs.length} run{data.runs.length !== 1 ? 's' : ''} progressed
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {data.runs.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[run.status] ?? STATUS_COLORS.pending}`}
                      >
                        {run.status}
                      </span>
                    </div>
                    {run.prompt && (
                      <p className="text-xs text-gray-400 line-clamp-2">{run.prompt}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artifacts delivered */}
          {data.artifacts.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <FileText className="size-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-400">
                  {data.artifacts.length} artifact{data.artifacts.length !== 1 ? 's' : ''} delivered
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {data.artifacts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    <span className="text-xs text-gray-300 truncate">{a.filename}</span>
                    <span className="text-[10px] text-gray-600 shrink-0 ml-2">
                      {(a.sizeBytes / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions answered */}
          {data.answeredQuestions.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <MessageCircle className="size-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-400">
                  {data.answeredQuestions.length} question{data.answeredQuestions.length !== 1 ? 's' : ''} answered
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {data.answeredQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    <p className="text-xs text-gray-400 line-clamp-1">{q.content}</p>
                    {q.answer && (
                      <p className="mt-0.5 text-xs text-green-400/70 line-clamp-1">
                        {q.answer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
