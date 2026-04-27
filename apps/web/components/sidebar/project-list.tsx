'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, FolderIcon } from 'lucide-react';
import { useProjects } from '@/lib/hooks/use-projects';
import { NewProjectDialog } from './new-project-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export function ProjectList() {
  const { data: projects, isLoading } = useProjects();
  const pathname = usePathname();
  // Default closed per CONTEXT.md: "Project list (BeagleLabs is the only one
  // today) collapsed by default, expandable to show recent runs under each
  // project."
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex flex-col gap-1 p-3"
    >
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400 hover:text-white">
          <ChevronRight
            className={cn(
              'size-3 transition-transform',
              open && 'rotate-90',
            )}
          />
          Projects
        </CollapsibleTrigger>
        <NewProjectDialog />
      </div>

      <CollapsibleContent className="mt-2 flex flex-col gap-1">
        {isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {!isLoading && (!projects || projects.length === 0) && (
          <p className="py-2 text-center text-sm text-gray-500">
            No projects yet
          </p>
        )}

        {projects?.map((project: { id: string; name: string }) => {
          const href = `/projects/${project.id}`;
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={project.id}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <FolderIcon className="size-4 shrink-0" />
              <span className="truncate">{project.name}</span>
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
