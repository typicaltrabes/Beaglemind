'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  body: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Centered, muted card used by Timeline / Boardroom / Canvas to communicate
 * "feature is alive but has no data yet". Per CONTEXT.md `<decisions>` Item 7:
 * use `border border-white/10 bg-white/[0.02]` so the card reads informational,
 * not error.
 */
export function EmptyState({ title, body, footer, className }: EmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        className={cn(
          'mx-auto max-w-md rounded-lg border border-white/10 bg-white/[0.02] p-5 text-sm',
          className,
        )}
      >
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <div className="mt-2 text-sm text-muted-foreground">{body}</div>
        {footer && <div className="mt-3 text-xs">{footer}</div>}
      </div>
    </div>
  );
}
