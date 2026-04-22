'use client';

import { useMemo, useState } from 'react';
import type { HubEventEnvelope } from '@beagle-console/shared';

import { useRunStore } from '@/lib/stores/run-store';
import { useMode } from '@/lib/mode-context';
import { getAgentColor } from '@/lib/agent-colors';
import { getAgentConfig } from '@/lib/agent-config';
import { renderEvent } from '@/components/transcript/render-event';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  filterTimelineEvents,
  computeXPositions,
  nearestEventBySeq,
  sceneBoundaries,
} from '@/lib/timeline-utils';

interface TimelineViewProps {
  runId: string;
}

/**
 * Timeline tab (VIEW-01): horizontal scrubbable replay of a run.
 *
 *  - Reads eventOrder/events/scenes from useRunStore, and mode from useMode.
 *  - filterTimelineEvents drops sentinel_flag + state_transition in clean mode.
 *  - Each visible event renders as a colored dot positioned by its timestamp.
 *  - Scene boundaries render as dotted vertical lines with uppercase labels.
 *  - A native range slider under the lane snaps to the nearest visible event
 *    via nearestEventBySeq; clicking a dot toggles a detail panel that reuses
 *    renderEvent (same rendering path as Writers' Room).
 */
export function TimelineView({ runId }: TimelineViewProps) {
  const eventOrder = useRunStore((s) => s.eventOrder);
  const events = useRunStore((s) => s.events);
  const scenes = useRunStore((s) => s.scenes);
  const { mode } = useMode();
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);

  // Ordered, filtered event list (used for dots, tooltips, scrubber, snapping).
  const visible = useMemo<HubEventEnvelope[]>(() => {
    const raw = eventOrder
      .map((seq) => events[seq])
      .filter((e): e is HubEventEnvelope => Boolean(e));
    return filterTimelineEvents(raw, mode);
  }, [eventOrder, events, mode]);

  const visibleSeqs = useMemo(
    () => visible.map((e) => e.sequenceNumber),
    [visible],
  );

  const xPositions = useMemo(() => computeXPositions(visible), [visible]);

  // Scene dividers get their own x-position computation against the visible
  // event time-range so they land on the same coordinate system as the dots.
  const timeRange = useMemo(() => {
    if (visible.length === 0) return { min: 0, max: 0, span: 0 };
    const times = visible.map((e) => new Date(e.timestamp).getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    return { min, max, span: max - min };
  }, [visible]);

  const boundaries = useMemo(() => {
    const raw = sceneBoundaries(scenes, events);
    return raw.map((b) => {
      const t = new Date(b.firstTimestamp).getTime();
      const x = timeRange.span === 0 ? 0 : (t - timeRange.min) / timeRange.span;
      return { ...b, x: Math.max(0, Math.min(1, x)) };
    });
  }, [scenes, events, timeRange]);

  // Empty-state short-circuit (matches CONTEXT.md).
  if (eventOrder.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Run has not started yet
      </div>
    );
  }

  const firstSeq = visibleSeqs[0] ?? 0;
  const lastSeq = visibleSeqs[visibleSeqs.length - 1] ?? firstSeq;
  const sliderValue = selectedSeq ?? lastSeq;
  const hasVisibleEvents = visible.length > 0;
  const minContentWidth = Math.max(visible.length * 24, 100); // px

  return (
    <TooltipProvider delay={150}>
      <div className="flex h-full flex-col gap-3 px-4 py-3">
        {/* Scrollable lane container (wraps scene-label strip + dot lane + dividers). */}
        <div className="relative w-full overflow-x-auto">
          <div
            className="relative"
            style={{ minWidth: `${minContentWidth}px` }}
          >
            {/* Scene-name strip above the lane. */}
            <div className="relative h-6">
              {boundaries.map((b) => (
                <div
                  key={`label-${b.sceneId}`}
                  className="absolute top-0 -translate-x-1/2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70"
                  style={{ left: `${b.x * 100}%` }}
                  title={b.sceneName}
                >
                  {b.sceneName.length > 24
                    ? `${b.sceneName.slice(0, 24)}…`
                    : b.sceneName}
                </div>
              ))}
            </div>

            {/* The lane: dots + scene divider lines. */}
            <div className="relative h-16 w-full border-y border-white/10 bg-muted/20">
              {/* Scene dividers (dotted vertical lines). */}
              {boundaries.map((b) => (
                <div
                  key={`line-${b.sceneId}`}
                  className="absolute top-0 bottom-0 w-px border-l border-dotted border-white/20"
                  style={{ left: `${b.x * 100}%` }}
                />
              ))}

              {/* Event dots. */}
              {visible.map((event) => {
                const x = xPositions[event.sequenceNumber] ?? 0;
                const config = getAgentConfig(event.agentId);
                const contentText =
                  typeof event.content.text === 'string'
                    ? event.content.text
                    : typeof event.content.summary === 'string'
                      ? event.content.summary
                      : '';
                const preview = contentText.slice(0, 80);
                const isSelected = selectedSeq === event.sequenceNumber;

                return (
                  <Tooltip key={event.sequenceNumber}>
                    <TooltipTrigger
                      render={(triggerProps) => (
                        <button
                          {...triggerProps}
                          type="button"
                          aria-label={`${config.displayName} ${event.type}`}
                          aria-pressed={isSelected}
                          onClick={() =>
                            setSelectedSeq((prev) =>
                              prev === event.sequenceNumber
                                ? null
                                : event.sequenceNumber,
                            )
                          }
                          className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-full ${getAgentColor(event.agentId)} ring-offset-background transition-all hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 ${
                            isSelected
                              ? 'ring-2 ring-foreground/80 ring-offset-2 scale-125'
                              : ''
                          }`}
                          style={{ left: `calc(${x * 100}% - 6px)` }}
                        />
                      )}
                    />
                    <TooltipContent>
                      <div className="space-y-0.5">
                        <div className="font-medium">{config.displayName}</div>
                        <div className="text-muted-foreground">
                          {event.type}
                        </div>
                        {preview && (
                          <div className="text-[11px]">{preview}</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrubber slider — snaps to nearest visible sequence. */}
        <input
          type="range"
          min={firstSeq}
          max={lastSeq}
          step={1}
          value={sliderValue}
          disabled={!hasVisibleEvents || firstSeq === lastSeq}
          onChange={(e) => {
            const raw = Number(e.target.value);
            const snapped = nearestEventBySeq(raw, visibleSeqs);
            setSelectedSeq(snapped);
          }}
          className="w-full accent-amber-500 disabled:opacity-50"
          aria-label="Timeline scrubber"
        />

        {/* Detail panel — shown when a dot is selected. */}
        {selectedSeq !== null && events[selectedSeq] && (
          <div className="rounded-lg border border-white/10 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Event #{selectedSeq}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSeq(null)}
              >
                Close
              </Button>
            </div>
            <div>{renderEvent(events[selectedSeq], runId)}</div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
