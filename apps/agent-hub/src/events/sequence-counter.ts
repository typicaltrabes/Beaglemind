import { eq, sql } from 'drizzle-orm';

/**
 * Per-run monotonic sequence counter (D-09).
 * In-memory counter with optional DB recovery on first access.
 * When no DB is provided, operates in pure in-memory mode (for testing).
 */
export class SequenceCounter {
  private counters = new Map<string, number>();

  /**
   * Get the next sequence number for a run.
   * On first call for a run, recovers from DB if available (restart recovery per D-09).
   * Without DB, starts at 0 (next returns 1).
   */
  async next(
    runId: string,
    db?: { select: Function },
    eventsTable?: { runId: unknown; sequenceNumber: unknown },
  ): Promise<number> {
    let current = this.counters.get(runId);

    if (current === undefined) {
      if (db && eventsTable) {
        try {
          const result = await (db as any)
            .select({ max: sql`COALESCE(MAX(${eventsTable.sequenceNumber}), 0)` })
            .from(eventsTable)
            .where(eq(eventsTable.runId as any, runId));
          current = Number(result[0]?.max ?? 0);
        } catch {
          current = 0;
        }
      } else {
        current = 0;
      }
    }

    const next = current + 1;
    this.counters.set(runId, next);
    return next;
  }

  /** Clear counter for a run (e.g., when run completes). */
  reset(runId: string): void {
    this.counters.delete(runId);
  }
}
