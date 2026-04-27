import type { HubEventEnvelope } from '@beagle-console/shared';

interface Scene {
  id: string;
  name: string;
  eventSequences: number[];
}

/** Map from agentId → events, ordered chronologically by sequence number. */
export type SceneGridCell = {
  agentId: string;
  events: HubEventEnvelope[];
};

export interface SceneGridRow {
  sceneId: string;
  sceneName: string;
  cells: Record<string, HubEventEnvelope[]>;
}

export interface SceneGrid {
  rows: SceneGridRow[];
  agents: string[];
}

/**
 * Returns the agent column ordering: known agents in the canonical order
 * mo, jarvis, herman, then any other agents (preserving input order),
 * with `user` always last. De-duplicates.
 *
 * Per CONTEXT.md `<decisions>` Item 7 Boardroom: "Columns: each unique agent
 * in `messages` (Mo / Jarvis / Herman / user, in that order; user always
 * last column)."
 */
export function orderedAgents(agentIds: string[]): string[] {
  const KNOWN_FIRST = ['mo', 'jarvis', 'herman'];
  const seen = new Set<string>();
  const known: string[] = [];
  const other: string[] = [];
  let hasUser = false;

  for (const raw of agentIds) {
    const id = (raw ?? '').toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (id === 'user') {
      hasUser = true;
      continue;
    }
    // KNOWN_FIRST get fixed order; others preserve input order.
    if (KNOWN_FIRST.includes(id)) {
      known.push(id);
    } else {
      other.push(id);
    }
  }

  // Sort known into the canonical order regardless of input order.
  known.sort((a, b) => KNOWN_FIRST.indexOf(a) - KNOWN_FIRST.indexOf(b));

  const result = [...known, ...other];
  if (hasUser) result.push('user');
  return result;
}

/**
 * Builds the scene-aligned grid model.
 *
 *   - rows: one per scene, in scene order. If no scenes are defined,
 *     a single synthetic 'Run' row holds every event.
 *   - cells: keyed by agentId; events sorted by sequenceNumber.
 *   - agents: the column ordering returned by orderedAgents over all
 *     unique agentIds in `messages`.
 */
export function buildSceneGrid(
  messages: HubEventEnvelope[],
  scenes: Scene[],
  events: Record<number, HubEventEnvelope>,
): SceneGrid {
  const agents = orderedAgents(messages.map((m) => m.agentId));

  // Empty path: no events → no rows.
  if (messages.length === 0) {
    return { rows: [], agents };
  }

  // No-scenes path: one synthetic row for every event.
  if (scenes.length === 0) {
    const cells: Record<string, HubEventEnvelope[]> = {};
    for (const a of agents) cells[a] = [];
    for (const m of messages) {
      const id = m.agentId.toLowerCase();
      cells[id]?.push(m);
    }
    for (const a of agents) {
      cells[a]?.sort((p, q) => p.sequenceNumber - q.sequenceNumber);
    }
    return {
      agents,
      rows: [{ sceneId: 'run', sceneName: 'Run', cells }],
    };
  }

  // Scenes path: bucket each event into the scene whose eventSequences contains it.
  const seqToScene = new Map<number, string>();
  for (const s of scenes) {
    for (const seq of s.eventSequences) seqToScene.set(seq, s.id);
  }

  const rowsById: Record<string, SceneGridRow> = {};
  for (const s of scenes) {
    const cells: Record<string, HubEventEnvelope[]> = {};
    for (const a of agents) cells[a] = [];
    rowsById[s.id] = { sceneId: s.id, sceneName: s.name, cells };
  }

  for (const m of messages) {
    const sceneId = seqToScene.get(m.sequenceNumber);
    if (!sceneId) continue; // event not in any scene — drop (matches existing groupEventsByAgent behavior of trusting scenes/messages alignment)
    const id = m.agentId.toLowerCase();
    const row = rowsById[sceneId];
    if (row?.cells[id]) row.cells[id].push(m);
  }

  // Sort each cell ascending by sequenceNumber.
  for (const row of Object.values(rowsById)) {
    for (const a of agents) {
      row.cells[a]?.sort((p, q) => p.sequenceNumber - q.sequenceNumber);
    }
  }

  return {
    agents,
    rows: scenes.map((s) => rowsById[s.id]).filter((r): r is SceneGridRow => Boolean(r)),
  };
}
