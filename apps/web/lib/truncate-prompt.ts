/**
 * Truncates a string to at most `max` chars; appends an ellipsis when
 * truncated. Used by the run-history table, run page header, and Canvas
 * empty state as a fallback when no AI title is available yet.
 *
 * Pure function — no side effects. Lives in its own module so client
 * components can import it without dragging in the server-only DB / auth
 * code that also lives in run-title.ts.
 */
export function truncatePrompt(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}
