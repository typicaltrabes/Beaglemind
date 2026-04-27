'use client';

import { useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useRunStore } from '@/lib/stores/run-store';
import { detectCollapsibleRanges, type CollapsibleRange } from '@/lib/scene-utils';
import { SceneDivider } from './scene-divider';
import { CollapseFold } from './collapse-fold';
import { renderEvent } from './render-event';
import { WritersRoomSkeleton } from './loading-skeleton';

// ---------- Render-item discriminated union ----------

type RenderItem =
  | { kind: 'scene-divider'; sceneId: string; sceneName: string }
  | { kind: 'event'; seq: number }
  | { kind: 'collapse-fold'; range: CollapsibleRange };

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

  function renderItem(_index: number, item: RenderItem): React.ReactNode {
    switch (item.kind) {
      case 'scene-divider':
        return <SceneDivider name={item.sceneName} />;
      case 'collapse-fold':
        return (
          <CollapseFold
            range={item.range}
            events={events}
            renderEvent={(seq) => renderEvent(events[seq], runId)}
          />
        );
      case 'event':
        return renderEvent(events[item.seq], runId);
    }
  }

  // ---------- Empty state ----------

  if (eventOrder.length === 0) {
    return <WritersRoomSkeleton />;
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
