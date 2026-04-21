'use client';

import { useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useRunStore } from '@/lib/stores/run-store';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { detectCollapsibleRanges, type CollapsibleRange } from '@/lib/scene-utils';
import { AgentMessage } from './agent-message';
import { SceneDivider } from './scene-divider';
import { CollapseFold } from './collapse-fold';
import { PlanCard } from './plan-card';
import { QuestionCard } from './question-card';
import { ArtifactCard } from './artifact-card';

// ---------- Render-item discriminated union ----------

type RenderItem =
  | { kind: 'scene-divider'; sceneId: string; sceneName: string }
  | { kind: 'event'; seq: number }
  | { kind: 'collapse-fold'; range: CollapsibleRange };

// ---------- State transition (kept inline — simple presentational) ----------

function StateTransitionMessage({ event }: { event: HubEventEnvelope }) {
  const content = event.content as { from?: string; to?: string };

  return (
    <div className="py-2 text-center">
      <span className="text-xs text-muted-foreground">
        Run transitioned from{' '}
        <span className="font-medium">{content.from}</span> to{' '}
        <span className="font-medium">{content.to}</span>
      </span>
    </div>
  );
}

// ---------- MessageList ----------

interface MessageListProps {
  runId: string;
}

export function MessageList({ runId }: MessageListProps) {
  const eventOrder = useRunStore((s) => s.eventOrder);
  const events = useRunStore((s) => s.events);
  const scenes = useRunStore((s) => s.scenes);

  // Track whether user is at the bottom (for auto-scroll)
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Build flat render list from scenes, inserting dividers and collapse folds
  const renderItems = useMemo(() => {
    const items: RenderItem[] = [];

    for (const scene of scenes) {
      // Insert scene divider if the scene has a name
      if (scene.name) {
        items.push({ kind: 'scene-divider', sceneId: scene.id, sceneName: scene.name });
      }

      // Detect collapsible ranges within this scene
      const ranges = detectCollapsibleRanges(scene.eventSequences, events);

      // Build a set of sequences that belong to a collapse fold (for fast lookup)
      const collapsedSeqs = new Set<number>();
      const rangeStartMap = new Map<number, CollapsibleRange>();
      for (const range of ranges) {
        rangeStartMap.set(range.startSeq, range);
        for (const seq of range.sequences) {
          collapsedSeqs.add(seq);
        }
      }

      // Walk sequences — emit event items or collapse-fold items
      for (const seq of scene.eventSequences) {
        if (rangeStartMap.has(seq)) {
          // This is the start of a collapsible range
          items.push({ kind: 'collapse-fold', range: rangeStartMap.get(seq)! });
        } else if (!collapsedSeqs.has(seq)) {
          // Normal event (not part of any collapse fold)
          items.push({ kind: 'event', seq });
        }
        // Otherwise: seq is inside a collapse fold but not the start — skip
      }
    }

    return items;
  }, [scenes, events]);

  // ---------- Render helpers ----------

  function renderSingleEvent(seq: number): React.ReactNode {
    const event = events[seq];
    if (!event) return null;
    switch (event.type) {
      case 'plan_proposal':
        return <PlanCard event={event} runId={runId} />;
      case 'question':
        return <QuestionCard event={event} runId={runId} />;
      case 'artifact':
        return <ArtifactCard event={event} />;
      case 'agent_message':
        return <AgentMessage event={event} />;
      case 'state_transition':
        return <StateTransitionMessage event={event} />;
      default:
        return null;
    }
  }

  function renderItem(_index: number, item: RenderItem): React.ReactNode {
    switch (item.kind) {
      case 'scene-divider':
        return <SceneDivider name={item.sceneName} />;
      case 'collapse-fold':
        return (
          <CollapseFold
            range={item.range}
            events={events}
            renderEvent={(seq) => renderSingleEvent(seq)}
          />
        );
      case 'event':
        return renderSingleEvent(item.seq);
    }
  }

  // ---------- Empty state ----------

  if (eventOrder.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Waiting for events...</p>
      </div>
    );
  }

  // ---------- Virtualized list ----------

  return (
    <Virtuoso
      data={renderItems}
      itemContent={renderItem}
      followOutput={isAtBottom ? 'smooth' : false}
      atBottomStateChange={setIsAtBottom}
      overscan={200}
      className="h-full"
      style={{ height: '100%' }}
    />
  );
}
