'use client';

import { useRunStore } from '@/lib/stores/run-store';
import { SentinelSection } from './sentinel-section';
import { CostSection } from './cost-section';
import { ForkSection } from './fork-section';

interface ProcessDrawerProps {
  runId: string;
}

export function ProcessDrawer({ runId }: ProcessDrawerProps) {
  const events = useRunStore((s) => s.events);
  const eventOrder = useRunStore((s) => s.eventOrder);

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-card">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3">
        <span className="text-sm font-medium text-foreground">Process</span>
      </div>

      {/* Sections */}
      <div className="flex flex-1 flex-col">
        <div className="border-b border-white/5">
          <SentinelSection events={events} eventOrder={eventOrder} />
        </div>
        <div className="border-b border-white/5">
          <CostSection events={events} eventOrder={eventOrder} />
        </div>
        <div>
          <ForkSection runId={runId} />
        </div>
      </div>
    </div>
  );
}
