export type RunStatus = 'pending' | 'planned' | 'approved' | 'executing' | 'completed' | 'cancelled';

const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  pending: ['planned'],
  planned: ['approved', 'cancelled'],
  approved: ['executing'],
  executing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition: ${from} -> ${to}`);
  }
}

export const RUN_STATUSES = Object.keys(VALID_TRANSITIONS) as RunStatus[];
export const TERMINAL_STATUSES: RunStatus[] = ['completed', 'cancelled'];
