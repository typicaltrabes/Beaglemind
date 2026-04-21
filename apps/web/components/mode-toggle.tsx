'use client';

import { useEffect } from 'react';
import { useMode, type Mode } from '@/lib/mode-context';

const segments: { value: Mode; label: string }[] = [
  { value: 'clean', label: 'Clean' },
  { value: 'studio', label: 'Studio' },
];

export function ModeToggle() {
  const { mode, setMode, toggle } = useMode();

  // Keyboard shortcut: Cmd/Ctrl+Shift+M
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return (
    <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
      {segments.map((seg) => {
        const isActive = mode === seg.value;
        return (
          <button
            key={seg.value}
            type="button"
            onClick={() => setMode(seg.value)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-amber-500 text-black'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
