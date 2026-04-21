'use client';

import { useState } from 'react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { GitBranch, ChevronDown, ChevronUp } from 'lucide-react';

interface ForkSectionProps {
  runId: string;
}

export function ForkSection({ runId: _runId }: ForkSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Fork / Branch
        </span>
        {open ? (
          <ChevronUp className="size-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2">
        <div className="flex items-center gap-2 py-1">
          <GitBranch className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-foreground">Main branch</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Fork/branch history will appear here
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
