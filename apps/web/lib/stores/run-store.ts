'use client';

import { create } from 'zustand';
import type { HubEventEnvelope } from '@beagle-console/shared';
import type { RunStatus } from '@/lib/state-machine';

export interface Scene {
  id: string;
  name: string;
  eventSequences: number[];  // sequence numbers belonging to this scene
}

interface RunState {
  runId: string | null;
  events: Record<number, HubEventEnvelope>;
  eventOrder: number[];
  lastSequence: number;
  status: RunStatus;

  // Derived state (recomputed on appendEvent)
  plan: HubEventEnvelope | null;
  unansweredQuestions: HubEventEnvelope[];
  artifacts: HubEventEnvelope[];
  messages: HubEventEnvelope[];
  scenes: Scene[];
  currentSceneId: string | null;
  tldrSummary: string | null;

  // Phase 19-03 (UX-19-05): per-agent presence indicator. Set by
  // `presence_thinking_start`, cleared by either the matching
  // `presence_thinking_end` OR an `agent_message` from the same agent
  // (whichever first). Last-writer-wins on overlapping `_start` events.
  // Reset to null on initRun. Presence events do NOT enter the events
  // map / eventOrder array — they're a UI-only slice.
  thinkingAgent: string | null;
}

interface RunActions {
  initRun: (runId: string) => void;
  appendEvent: (event: HubEventEnvelope) => void;
  appendEvents: (events: HubEventEnvelope[]) => void;
  updateQuestion: (questionId: string, answer: string) => void;
  reset: () => void;
}

const INITIAL_STATE: RunState = {
  runId: null,
  events: {},
  eventOrder: [],
  lastSequence: 0,
  status: 'pending',
  plan: null,
  unansweredQuestions: [],
  artifacts: [],
  messages: [],
  scenes: [],
  currentSceneId: null,
  tldrSummary: null,
  // Phase 19-03 (UX-19-05): no agent thinking by default.
  thinkingAgent: null,
};

function deriveState(events: Record<number, HubEventEnvelope>, eventOrder: number[]) {
  let plan: HubEventEnvelope | null = null;
  const unansweredQuestions: HubEventEnvelope[] = [];
  const artifacts: HubEventEnvelope[] = [];
  const messages: HubEventEnvelope[] = [];
  const scenes: Scene[] = [];
  let currentSceneId: string | null = null;
  let tldrSummary: string | null = null;

  // Map from sceneId to index in scenes array
  const sceneIndex = new Map<string, number>();

  for (const seq of eventOrder) {
    const event = events[seq];
    if (!event) continue;

    // Extract TLDR updates (metadata-only, not pushed to messages)
    if (event.type === 'tldr_update') {
      if (typeof event.content.summary === 'string') {
        tldrSummary = event.content.summary;
      }
      // Do NOT push tldr_update into messages array
      continue;
    }

    messages.push(event);

    if (event.type === 'plan_proposal') {
      plan = event;
    }
    if (event.type === 'question' && !event.content.answer) {
      unansweredQuestions.push(event);
    }
    if (event.type === 'artifact') {
      artifacts.push(event);
    }

    // Scene grouping
    const meta = event.metadata as Record<string, unknown> | undefined;
    const eventSceneId = typeof meta?.sceneId === 'string' ? meta.sceneId : null;

    if (eventSceneId && eventSceneId !== currentSceneId) {
      // New scene detected
      currentSceneId = eventSceneId;
      let sceneName = typeof meta?.sceneName === 'string' ? meta.sceneName : '';

      // If sceneName missing, derive from first agent_message content
      if (!sceneName && event.type === 'agent_message') {
        const text = typeof event.content.text === 'string' ? event.content.text : '';
        sceneName = text.length > 50 ? text.slice(0, 50) + '...' : text;
      }

      sceneIndex.set(eventSceneId, scenes.length);
      scenes.push({ id: eventSceneId, name: sceneName, eventSequences: [seq] });
    } else if (eventSceneId && sceneIndex.has(eventSceneId)) {
      // Existing scene
      const idx = sceneIndex.get(eventSceneId)!;
      scenes[idx]!.eventSequences.push(seq);
    } else if (currentSceneId && sceneIndex.has(currentSceneId)) {
      // No sceneId on event — assign to current scene
      const idx = sceneIndex.get(currentSceneId)!;
      scenes[idx]!.eventSequences.push(seq);
    } else {
      // No scenes exist yet — create synthetic unscened group
      if (!sceneIndex.has('unscened')) {
        currentSceneId = 'unscened';
        sceneIndex.set('unscened', scenes.length);
        scenes.push({ id: 'unscened', name: '', eventSequences: [seq] });
      } else {
        const idx = sceneIndex.get('unscened')!;
        scenes[idx]!.eventSequences.push(seq);
      }
    }

    // If this is the first agent_message in a scene that has no name yet, derive name
    if (event.type === 'agent_message') {
      const activeSceneIdx = sceneIndex.get(currentSceneId ?? 'unscened');
      const activeScene = activeSceneIdx !== undefined ? scenes[activeSceneIdx] : undefined;
      if (activeScene && !activeScene.name && activeScene.id !== 'unscened') {
        const text = typeof event.content.text === 'string' ? event.content.text : '';
        activeScene.name = text.length > 50 ? text.slice(0, 50) + '...' : text;
      }
    }
  }

  return { plan, unansweredQuestions, artifacts, messages, scenes, currentSceneId, tldrSummary };
}

function processEvent(
  events: Record<number, HubEventEnvelope>,
  eventOrder: number[],
  lastSequence: number,
  status: RunStatus,
  event: HubEventEnvelope,
): { events: Record<number, HubEventEnvelope>; eventOrder: number[]; lastSequence: number; status: RunStatus } | null {
  // Dedup: skip if already seen
  if (event.sequenceNumber <= lastSequence) return null;

  const newEvents = { ...events, [event.sequenceNumber]: event };
  const newOrder = [...eventOrder, event.sequenceNumber];
  let newStatus = status;

  if (event.type === 'state_transition' && typeof event.content.to === 'string') {
    newStatus = event.content.to as RunStatus;
  }

  return {
    events: newEvents,
    eventOrder: newOrder,
    lastSequence: event.sequenceNumber,
    status: newStatus,
  };
}

export const useRunStore = create<RunState & RunActions>()((set, get) => ({
  ...INITIAL_STATE,

  initRun: (runId: string) =>
    set({ ...INITIAL_STATE, runId }),

  appendEvent: (event: HubEventEnvelope) => {
    const state = get();

    // Phase 19-03 (UX-19-05): presence events drive the thinkingAgent slice
    // ONLY — they do not enter the events map / eventOrder array, because
    // (a) the SSE replay would re-fire them on reconnect, and (b) the
    // transcript rendering doesn't need them as items (the live slice does).
    if (event.type === 'presence_thinking_start') {
      set({ thinkingAgent: event.agentId });
      return;
    }
    if (event.type === 'presence_thinking_end') {
      // Only clear if this end matches the currently-thinking agent. Avoids
      // races where end-A arrives after start-B (last-writer-wins on starts).
      if (state.thinkingAgent === event.agentId) {
        set({ thinkingAgent: null });
      }
      return;
    }
    // presence_typing reserved for a future streaming bridge — same UI-only
    // semantics. v1: ignored (no slice change, no event-array entry).
    if (event.type === 'presence_typing') {
      return;
    }

    // Phase 19-03: defense in depth — when an agent's actual reply lands
    // before the explicit `_end` arrives (or the `_end` is dropped),
    // clear the indicator early. The matching `_end` will be a no-op.
    let nextThinkingAgent = state.thinkingAgent;
    if (
      event.type === 'agent_message' &&
      state.thinkingAgent === event.agentId
    ) {
      nextThinkingAgent = null;
    }

    const result = processEvent(state.events, state.eventOrder, state.lastSequence, state.status, event);
    if (!result) {
      // Dedup -- already seen. Still apply the thinkingAgent reset if the
      // event would have otherwise triggered one (idempotent UI clear).
      if (nextThinkingAgent !== state.thinkingAgent) {
        set({ thinkingAgent: nextThinkingAgent });
      }
      return;
    }

    const derived = deriveState(result.events, result.eventOrder);
    set({ ...result, ...derived, thinkingAgent: nextThinkingAgent });
  },

  appendEvents: (events: HubEventEnvelope[]) => {
    const state = get();
    let currentEvents = state.events;
    let currentOrder = state.eventOrder;
    let currentLastSeq = state.lastSequence;
    let currentStatus = state.status;
    let currentThinkingAgent = state.thinkingAgent;
    let changed = false;
    let presenceChanged = false;

    for (const event of events) {
      // Phase 19-03 (UX-19-05): presence events update the thinkingAgent
      // slice only — same semantics as appendEvent above. They do not
      // contribute to events / eventOrder. SSE replay on reconnect emits
      // them in order, so the final thinkingAgent state matches the live
      // hub state once replay completes.
      if (event.type === 'presence_thinking_start') {
        currentThinkingAgent = event.agentId;
        presenceChanged = true;
        continue;
      }
      if (event.type === 'presence_thinking_end') {
        if (currentThinkingAgent === event.agentId) {
          currentThinkingAgent = null;
          presenceChanged = true;
        }
        continue;
      }
      if (event.type === 'presence_typing') {
        continue;
      }

      // Phase 19-03: matching agent_message clears the indicator early.
      if (
        event.type === 'agent_message' &&
        currentThinkingAgent === event.agentId
      ) {
        currentThinkingAgent = null;
        presenceChanged = true;
      }

      const result = processEvent(currentEvents, currentOrder, currentLastSeq, currentStatus, event);
      if (!result) continue;
      currentEvents = result.events;
      currentOrder = result.eventOrder;
      currentLastSeq = result.lastSequence;
      currentStatus = result.status;
      changed = true;
    }

    if (!changed && !presenceChanged) return;

    if (!changed) {
      // Only the presence slice changed.
      set({ thinkingAgent: currentThinkingAgent });
      return;
    }

    const derived = deriveState(currentEvents, currentOrder);
    set({
      events: currentEvents,
      eventOrder: currentOrder,
      lastSequence: currentLastSeq,
      status: currentStatus,
      thinkingAgent: currentThinkingAgent,
      ...derived,
    });
  },

  updateQuestion: (questionId: string, answer: string) => {
    const state = get();
    // Find the question event and update its content
    const updatedEvents = { ...state.events };
    let found = false;

    for (const seq of state.eventOrder) {
      const event = updatedEvents[seq];
      if (event?.type === 'question' && event.content.questionId === questionId) {
        updatedEvents[seq] = {
          ...event,
          content: { ...event.content, answer },
        };
        found = true;
        break;
      }
    }

    if (!found) return;

    const derived = deriveState(updatedEvents, state.eventOrder);
    set({ events: updatedEvents, ...derived });
  },

  reset: () => set(INITIAL_STATE),
}));
