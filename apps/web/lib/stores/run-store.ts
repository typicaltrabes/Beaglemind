'use client';

import { create } from 'zustand';
import type { HubEventEnvelope } from '@beagle-console/shared';
import type { RunStatus } from '@/lib/state-machine';

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
};

function deriveState(events: Record<number, HubEventEnvelope>, eventOrder: number[]) {
  let plan: HubEventEnvelope | null = null;
  const unansweredQuestions: HubEventEnvelope[] = [];
  const artifacts: HubEventEnvelope[] = [];
  const messages: HubEventEnvelope[] = [];

  for (const seq of eventOrder) {
    const event = events[seq];
    if (!event) continue;

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
  }

  return { plan, unansweredQuestions, artifacts, messages };
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
