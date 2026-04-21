'use client';

import { useApproveRun, useStopRun } from '@/lib/hooks/use-run-actions';
import { useRunStore } from '@/lib/stores/run-store';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface PlanCardProps {
  event: HubEventEnvelope;
  runId: string;
}

export function PlanCard({ event, runId }: PlanCardProps) {
  const status = useRunStore((s) => s.status);
  const approveRun = useApproveRun();
  const stopRun = useStopRun();

  const content = event.content as {
    plan: string | Record<string, unknown>;
    costEstimate?: { min: number; max: number; currency: string };
    durationEstimate?: string;
    agents?: string[];
  };

  const isActionable = status === 'planned';
  const isPending = approveRun.isPending || stopRun.isPending;

  function handleApprove() {
    approveRun.mutate(runId);
  }

  function handleReject() {
    stopRun.mutate(runId);
  }

  const planText =
    typeof content.plan === 'string'
      ? content.plan
      : JSON.stringify(content.plan, null, 2);

  const costLabel = content.costEstimate
    ? `$${content.costEstimate.min}-${content.costEstimate.max}`
    : null;

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-amber-500">Research Plan</CardTitle>
          <Badge variant="outline" className="text-xs capitalize">
            {status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm text-foreground">
          {planText}
        </pre>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {costLabel && (
            <span>
              Cost: <span className="text-foreground font-medium">{costLabel}</span>
            </span>
          )}
          {content.durationEstimate && (
            <span>
              Duration:{' '}
              <span className="text-foreground font-medium">
                {content.durationEstimate}
              </span>
            </span>
          )}
        </div>

        {content.agents && content.agents.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {content.agents.map((agent) => (
              <Badge key={agent} variant="secondary" className="text-xs">
                {agent}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Button
          onClick={handleApprove}
          disabled={!isActionable || isPending}
          className="bg-amber-500 text-black hover:bg-amber-600"
        >
          {approveRun.isPending ? 'Approving...' : 'Approve'}
        </Button>
        <Button
          variant="ghost"
          onClick={handleReject}
          disabled={!isActionable || isPending}
          className="text-destructive hover:text-destructive"
        >
          {stopRun.isPending ? 'Rejecting...' : 'Reject'}
        </Button>

        {!isActionable && status !== 'pending' && (
          <span className="ml-auto text-xs text-muted-foreground">
            {status === 'cancelled' ? 'Rejected' : 'Approved'} at{' '}
            {new Date().toLocaleTimeString()}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
