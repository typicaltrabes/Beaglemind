'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects, useRuns } from '@/lib/hooks/use-projects';
import { useStartRun } from '@/lib/hooks/use-run-actions';
import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayIcon, ClockIcon } from 'lucide-react';
import Link from 'next/link';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-600/20 text-gray-400',
  planned: 'bg-yellow-600/20 text-yellow-400',
  approved: 'bg-blue-600/20 text-blue-400',
  executing: 'bg-green-600/20 text-green-400 animate-pulse',
  completed: 'bg-green-600/20 text-green-400',
  cancelled: 'bg-red-600/20 text-red-400',
};

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [prompt, setPrompt] = useState('');

  const { data: projects } = useProjects();
  const { data: runs, isLoading: runsLoading } = useRuns(projectId);
  const startRun = useStartRun();

  const project = projects?.find(
    (p: { id: string }) => p.id === projectId
  );

  useEffect(() => {
    useUIStore.getState().setActiveProject(projectId);
    return () => {
      useUIStore.getState().setActiveProject(null);
    };
  }, [projectId]);

  async function handleStartSprint() {
    if (!prompt.trim()) return;
    try {
      const run = await startRun.mutateAsync({
        projectId,
        prompt: prompt.trim(),
      });
      setPrompt('');
      if (run?.id) {
        router.push(`/projects/${projectId}/runs/${run.id}`);
      }
    } catch {
      // Error handled by TanStack Query
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Project header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {project?.name ?? 'Project'}
        </h1>
        {project?.description && (
          <p className="mt-1 text-sm text-gray-400">{project.description}</p>
        )}
      </div>

      {/* New Sprint section */}
      <Card className="mb-8 border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-300">
          New Research Sprint
        </h2>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want Mo to research..."
          rows={3}
          className="mb-3 border-white/10 bg-white/5 text-white placeholder:text-gray-500"
        />
        <Button
          onClick={handleStartSprint}
          disabled={!prompt.trim() || startRun.isPending}
        >
          <PlayIcon className="size-4" />
          {startRun.isPending ? 'Starting...' : 'Start Sprint'}
        </Button>
      </Card>

      {/* Run list */}
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
          Runs
        </h2>

        {runsLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!runsLoading && (!runs || runs.length === 0) && (
          <p className="py-8 text-center text-sm text-gray-500">
            No runs yet. Start a sprint above.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {runs?.map(
            (run: {
              id: string;
              status: string;
              prompt: string;
              createdAt: string;
            }) => (
              <Link
                key={run.id}
                href={`/projects/${projectId}/runs/${run.id}`}
                className="block"
              >
                <Card className="border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge
                      className={
                        STATUS_STYLES[run.status] ?? STATUS_STYLES.pending
                      }
                    >
                      {run.status}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <ClockIcon className="size-3" />
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-gray-300">
                    {run.prompt}
                  </p>
                </Card>
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}
