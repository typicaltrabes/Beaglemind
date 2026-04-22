'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/tabs';
import { WritersRoomView } from './writers-room-view';
import { TimelineView } from './timeline-view';
import { BoardroomView } from './boardroom-view';
import { CanvasView } from './canvas-view';

// Whitelist of known tab values. Any other ?view= string is rejected and falls
// back to the default. The whitelist also doubles as a tamper check for the
// query param (threat T-11-01 in the plan threat model).
const TAB_VALUES = ['writers-room', 'timeline', 'boardroom', 'canvas'] as const;
type TabValue = (typeof TAB_VALUES)[number];
const DEFAULT_TAB: TabValue = 'writers-room';

function parseView(v: string | null): TabValue {
  return (TAB_VALUES as readonly string[]).includes(v ?? '')
    ? (v as TabValue)
    : DEFAULT_TAB;
}

interface RunViewTabsProps {
  runId: string;
}

export function RunViewTabs({ runId }: RunViewTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = parseView(searchParams.get('view'));

  function handleChange(next: string | number | null) {
    const value = typeof next === 'string' ? next : DEFAULT_TAB;
    const params = new URLSearchParams(searchParams.toString());
    // Canonical URL: default tab has no ?view= param.
    if (value === DEFAULT_TAB) {
      params.delete('view');
    } else {
      params.set('view', value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Tabs
      value={active}
      onValueChange={handleChange}
      className="flex flex-1 min-h-0 flex-col"
    >
      <TabsList className="mx-4 mt-3 w-fit">
        <TabsTab value="writers-room">Writers&apos; Room</TabsTab>
        <TabsTab value="timeline">Timeline</TabsTab>
        <TabsTab value="boardroom">Boardroom</TabsTab>
        <TabsTab value="canvas">Canvas</TabsTab>
      </TabsList>

      <TabsPanel
        value="writers-room"
        className="flex flex-1 min-h-0 flex-col"
      >
        <WritersRoomView runId={runId} />
      </TabsPanel>

      <TabsPanel
        value="timeline"
        className="flex flex-1 min-h-0 flex-col"
        data-testid="run-view-timeline"
      >
        <TimelineView runId={runId} />
      </TabsPanel>

      <TabsPanel
        value="boardroom"
        className="flex flex-1 min-h-0 flex-col"
        data-testid="run-view-boardroom"
      >
        <BoardroomView runId={runId} />
      </TabsPanel>

      <TabsPanel
        value="canvas"
        className="flex flex-1 min-h-0 flex-col"
        data-testid="run-view-canvas"
      >
        <CanvasView runId={runId} />
      </TabsPanel>
    </Tabs>
  );
}
