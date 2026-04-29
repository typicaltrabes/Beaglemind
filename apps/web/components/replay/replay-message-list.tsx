'use client';

import { useMemo, type ReactNode } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { detectCollapsibleRanges, type CollapsibleRange } from '@/lib/scene-utils';
import { AgentMessage } from '@/components/transcript/agent-message';
import { SceneDivider } from '@/components/transcript/scene-divider';
import { ArtifactCard } from '@/components/transcript/artifact-card';

// ---------- Read-only plan card (no approve/reject) ----------

function ReadOnlyPlanCard({ event }: { event: HubEventEnvelope }) {
  const content = event.content as {
    plan: string | Record<string, unknown>;
    costEstimate?: { min: number; max: number; currency: string };
    durationEstimate?: string;
    agents?: string[];
  };

  const planText =
    typeof content.plan === 'string'
      ? content.plan
      : JSON.stringify(content.plan, null, 2);

  return (
    <div className="rounded-lg border border-l-4 border-l-amber-500 bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-amber-500">Research Plan</h3>
      <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm text-foreground">
        {planText}
      </pre>
      {(content.costEstimate || content.durationEstimate) && (
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          {content.costEstimate && (
            <span>
              Cost:{' '}
              <span className="font-medium text-foreground">
                ${content.costEstimate.min}-${content.costEstimate.max}
              </span>
            </span>
          )}
          {content.durationEstimate && (
            <span>
              Duration:{' '}
              <span className="font-medium text-foreground">
                {content.durationEstimate}
              </span>
            </span>
          )}
        </div>
      )}
      {content.agents && content.agents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {content.agents.map((agent) => (
            <span
              key={agent}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {agent}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Read-only question card (no answer input) ----------

function ReadOnlyQuestionCard({ event }: { event: HubEventEnvelope }) {
  const content = event.content as {
    text: string;
    answer?: string;
  };

  return (
    <div className="rounded-lg border border-t-2 border-t-amber-500 bg-card p-4">
      <h3 className="mb-1 text-sm font-medium text-amber-500">
        Question for the team
      </h3>
      <p className="text-xs text-muted-foreground">from {event.agentId}</p>
      <p className="mt-2 text-sm text-foreground">{content.text}</p>
      {content.answer && (
        <div className="mt-2">
          <p className="rounded-md bg-muted/50 p-2 text-sm text-foreground">
            {content.answer}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Answered</p>
        </div>
      )}
    </div>
  );
}

// ---------- State transition (inline) ----------

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

// ---------- Read-only collapse fold (no mode dependency) ----------

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { getAgentConfig } from '@/lib/agent-config';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function ReadOnlyCollapseFold({
  range,
  events,
  renderEvent,
}: {
  range: CollapsibleRange;
  events: Record<number, HubEventEnvelope>;
  renderEvent: (seq: number) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const agentNames = range.agentIds.map((id) => getAgentConfig(id).displayName);
  const agentLabel =
    agentNames.length === 1
      ? agentNames[0]
      : agentNames.length === 2
        ? `${agentNames[0]} and ${agentNames[1]}`
        : agentNames.slice(0, -1).join(', ') + ', and ' + agentNames[agentNames.length - 1];
  const timeSpan = `${formatTime(range.startTime)} — ${formatTime(range.endTime)}`;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between rounded-md border border-dashed border-white/10 px-4 py-2 text-left transition-colors hover:border-white/20"
      >
        <div>
          <p className="text-sm text-muted-foreground">
            {agentLabel} exchanged {range.messageCount} messages
          </p>
          <p className="text-xs text-muted-foreground/60">{timeSpan}</p>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="mt-1 border-l border-white/5 pl-3">
          {range.sequences.map((seq) => (
            <div key={seq}>{renderEvent(seq)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Render-item types ----------

type RenderItem =
  | { kind: 'scene-divider'; sceneId: string; sceneName: string }
  | { kind: 'event'; seq: number }
  | { kind: 'collapse-fold'; range: CollapsibleRange };

interface Scene {
  id: string;
  name: string;
  eventSequences: number[];
}

// ---------- Scene derivation (pure, extracted from run-store logic) ----------

function deriveScenes(
  eventsMap: Record<number, HubEventEnvelope>,
  eventOrder: number[],
): Scene[] {
  const scenes: Scene[] = [];
  const sceneIndex = new Map<string, number>();
  let currentSceneId: string | null = null;

  for (const seq of eventOrder) {
    const event = eventsMap[seq];
    if (!event) continue;

    // Skip tldr_update from scene grouping (not a visible message)
    if (event.type === 'tldr_update') continue;

    const meta = event.metadata as Record<string, unknown> | undefined;
    const eventSceneId = typeof meta?.sceneId === 'string' ? meta.sceneId : null;

    if (eventSceneId && eventSceneId !== currentSceneId) {
      currentSceneId = eventSceneId;
      let sceneName = typeof meta?.sceneName === 'string' ? meta.sceneName : '';
      if (!sceneName && event.type === 'agent_message') {
        const text = typeof event.content.text === 'string' ? event.content.text : '';
        sceneName = text.length > 50 ? text.slice(0, 50) + '...' : text;
      }
      sceneIndex.set(eventSceneId, scenes.length);
      scenes.push({ id: eventSceneId, name: sceneName, eventSequences: [seq] });
    } else if (eventSceneId && sceneIndex.has(eventSceneId)) {
      const idx = sceneIndex.get(eventSceneId)!;
      scenes[idx]!.eventSequences.push(seq);
    } else if (currentSceneId && sceneIndex.has(currentSceneId)) {
      const idx = sceneIndex.get(currentSceneId)!;
      scenes[idx]!.eventSequences.push(seq);
    } else {
      if (!sceneIndex.has('unscened')) {
        currentSceneId = 'unscened';
        sceneIndex.set('unscened', scenes.length);
        scenes.push({ id: 'unscened', name: '', eventSequences: [seq] });
      } else {
        const idx = sceneIndex.get('unscened')!;
        scenes[idx]!.eventSequences.push(seq);
      }
    }

    // Derive scene name from first agent_message if still unnamed
    if (event.type === 'agent_message') {
      const activeSceneIdx = sceneIndex.get(currentSceneId ?? 'unscened');
      const activeScene = activeSceneIdx !== undefined ? scenes[activeSceneIdx] : undefined;
      if (activeScene && !activeScene.name && activeScene.id !== 'unscened') {
        const text = typeof event.content.text === 'string' ? event.content.text : '';
        activeScene.name = text.length > 50 ? text.slice(0, 50) + '...' : text;
      }
    }
  }

  return scenes;
}

// ---------- ReplayMessageList ----------

interface ReplayMessageListProps {
  events: HubEventEnvelope[];
}

export function ReplayMessageList({ events: eventArray }: ReplayMessageListProps) {
  // Build events map and order from the array
  const { eventsMap, eventOrder } = useMemo(() => {
    const map: Record<number, HubEventEnvelope> = {};
    const order: number[] = [];
    for (const event of eventArray) {
      map[event.sequenceNumber] = event;
      order.push(event.sequenceNumber);
    }
    return { eventsMap: map, eventOrder: order };
  }, [eventArray]);

  // Derive scenes
  const scenes = useMemo(() => deriveScenes(eventsMap, eventOrder), [eventsMap, eventOrder]);

  // Build flat render list with scene dividers and collapse folds
  const renderItems = useMemo(() => {
    const items: RenderItem[] = [];

    for (const scene of scenes) {
      if (scene.name) {
        items.push({ kind: 'scene-divider', sceneId: scene.id, sceneName: scene.name });
      }

      const ranges = detectCollapsibleRanges(scene.eventSequences, eventsMap);
      const collapsedSeqs = new Set<number>();
      const rangeStartMap = new Map<number, CollapsibleRange>();
      for (const range of ranges) {
        rangeStartMap.set(range.startSeq, range);
        for (const seq of range.sequences) {
          collapsedSeqs.add(seq);
        }
      }

      for (const seq of scene.eventSequences) {
        if (rangeStartMap.has(seq)) {
          items.push({ kind: 'collapse-fold', range: rangeStartMap.get(seq)! });
        } else if (!collapsedSeqs.has(seq)) {
          items.push({ kind: 'event', seq });
        }
      }
    }

    return items;
  }, [scenes, eventsMap]);

  // ---------- Render helpers ----------

  function renderSingleEvent(seq: number): ReactNode {
    const event = eventsMap[seq];
    if (!event) return null;
    switch (event.type) {
      case 'plan_proposal':
        return <ReadOnlyPlanCard event={event} />;
      case 'question':
        return <ReadOnlyQuestionCard event={event} />;
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

  function renderItem(_index: number, item: RenderItem): ReactNode {
    switch (item.kind) {
      case 'scene-divider':
        return <SceneDivider name={item.sceneName} />;
      case 'collapse-fold':
        return (
          <ReadOnlyCollapseFold
            range={item.range}
            events={eventsMap}
            renderEvent={(seq) => renderSingleEvent(seq)}
          />
        );
      case 'event':
        return renderSingleEvent(item.seq);
    }
  }

  // ---------- Empty state ----------

  if (eventArray.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No events in this replay.</p>
      </div>
    );
  }

  // ---------- Virtualized list ----------

  return (
    // Phase 18-02 followup: replay layout is min-h-screen (not h-screen),
    // so percentage heights collapse to 0. Virtuoso fills the parent via
    // flex grow + minHeight 0 instead of height: 100%.
    <Virtuoso
      data={renderItems}
      itemContent={renderItem}
      overscan={200}
      style={{ flex: '1 1 0%', minHeight: 0, height: 'auto' }}
    />
  );
}
