'use client';

import { ProjectList } from './project-list';
import { QuestionQueue } from './question-queue';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/lib/stores/ui-store';

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  if (!sidebarOpen) return null;

  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col border-r border-white/10 bg-bg">
      <ScrollArea className="flex-1">
        <ProjectList />
        <Separator className="my-2" />
        <QuestionQueue />
      </ScrollArea>
    </aside>
  );
}
