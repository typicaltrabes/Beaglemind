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
    const result = processEvent(state.events, state.eventOrder, state.lastSequence, state.status, event);
    if (!result) return; // Dedup -- already seen

    const derived = deriveState(result.events, result.eventOrder);
    set({ ...result, ...derived });
  },

  appendEvents: (events: HubEventEnvelope[]) => {
    const state = get();
    let currentEvents = state.events;
    let currentOrder = state.eventOrder;
    let currentLastSeq = state.lastSequence;
    let currentStatus = state.status;
    let changed = false;

    for (const event of events) {
      const result = processEvent(currentEvents, currentOrder, currentLastSeq, currentStatus, event);
      if (!result) continue;
      currentEvents = result.events;
      currentOrder = result.eventOrder;
      currentLastSeq = result.lastSequence;
      currentStatus = result.status;
      changed = true;
    }

    if (!changed) return;

    const derived = deriveState(currentEvents, currentOrder);
    set({
      events: currentEvents,
      eventOrder: currentOrder,
      lastSequence: currentLastSeq,
      status: currentStatus,
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
