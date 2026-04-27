'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/tabs';
import { WritersRoomView } from './writers-room-view';
import { TimelineView } from './timeline-view';
import { BoardroomView } from './boardroom-view';
import { CanvasView } from './canvas-view';
import { usePreferencesStore } from '@/lib/stores/preferences-store';

// Whitelist of known tab values. Any other ?view= string is rejected and falls
// back to the default. The whitelist also doubles as a tamper check for the
// query param (threat T-11-01 in the plan threat model).
const TAB_VALUES = ['writers-room', 'timeline', 'boardroom', 'canvas'] as const;
type TabValue = (typeof TAB_VALUES)[number];

function parseView(v: string | null, fallback: TabValue): TabValue {
  return (TAB_VALUES as readonly string[]).includes(v ?? '')
    ? (v as TabValue)
    : fallback;
}

interface RunViewTabsProps {
  runId: string;
}

export function RunViewTabs({ runId }: RunViewTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const preferredDefault = usePreferencesStore((s) => s.preferences.defaultTab);
  const effectiveDefault: TabValue = (TAB_VALUES as readonly string[]).includes(
    preferredDefault,
  )
    ? (preferredDefault as TabValue)
    : 'writers-room';
  const active = parseView(searchParams.get('view'), effectiveDefault);

  function handleChange(next: string | number | null) {
    const value = typeof next === 'string' ? next : effectiveDefault;
    const params = new URLSearchParams(searchParams.toString());
    // Canonical URL: a tab matching the user's effective default has no ?view= param.
    if (value === effectiveDefault) {
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
      <TabsList className="mx-4 mt-3 w-fit rounded-full border-0 bg-white/5 p-1">
        <TabsTab
          value="writers-room"
          className="rounded-full px-3 py-1.5 text-xs data-[selected]:bg-amber-500/15 data-[selected]:text-amber-400 data-[selected]:shadow-none"
        >
          Writers&apos; Room
        </TabsTab>
        <TabsTab
          value="timeline"
          className="rounded-full px-3 py-1.5 text-xs data-[selected]:bg-amber-500/15 data-[selected]:text-amber-400 data-[selected]:shadow-none"
        >
          Timeline
        </TabsTab>
        <TabsTab
          value="boardroom"
          className="rounded-full px-3 py-1.5 text-xs data-[selected]:bg-amber-500/15 data-[selected]:text-amber-400 data-[selected]:shadow-none"
        >
          Boardroom
        </TabsTab>
        <TabsTab
          value="canvas"
          className="rounded-full px-3 py-1.5 text-xs data-[selected]:bg-amber-500/15 data-[selected]:text-amber-400 data-[selected]:shadow-none"
        >
          Canvas
        </TabsTab>
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
