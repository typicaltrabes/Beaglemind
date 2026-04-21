'use client';

import { useRunStore } from '@/lib/stores/run-store';

export function TldrBanner() {
  const tldrSummary = useRunStore((s) => s.tldrSummary);

  if (!tldrSummary) return null;

  return (
    <div className="sticky top-0 z-10 border-b border-[#1d4a6e] bg-[#12283a] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1d4a6e]">
        Where we are
      </p>
      <p className="mt-1 text-sm text-gray-200">
        {tldrSummary}
      </p>
    </div>
  );
}
