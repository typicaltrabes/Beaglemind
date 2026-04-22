/**
 * Shared agent-color helper.
 *
 * Returns a tailwind palette class (`bg-<color>-<shade>`) for the given agent id.
 * Used by Timeline, Boardroom, and any other view that needs a consistent swatch.
 *
 * Values per CONTEXT.md §Agent color map:
 *   Mo       -> amber-500
 *   Jarvis   -> teal-500
 *   Sentinel -> purple-400 (matches AGENT_CONFIG.nameColor for parity)
 *   user     -> blue-400
 *   default  -> gray-500
 *
 * A switch is used instead of a map so the helper is tree-shake-friendly and
 * explicit about the small, bounded set of known agent ids.
 */
export function getAgentColor(agentId: string): string {
  const id = (agentId ?? '').toLowerCase();
  switch (id) {
    case 'mo':
      return 'bg-amber-500';
    case 'jarvis':
      return 'bg-teal-500';
    case 'sentinel':
      return 'bg-purple-400';
    case 'user':
      return 'bg-blue-400';
    default:
      return 'bg-gray-500';
  }
}
