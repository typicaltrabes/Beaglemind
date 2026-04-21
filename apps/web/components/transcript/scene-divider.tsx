'use client';

interface SceneDividerProps {
  name: string;
}

export function SceneDivider({ name }: SceneDividerProps) {
  if (!name) return null;

  return (
    <div className="flex items-center gap-3 py-4">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {name}
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}
