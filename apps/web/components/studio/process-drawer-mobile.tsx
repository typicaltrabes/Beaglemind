'use client';

import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface MobileDrawerWrapperProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileDrawerWrapper({
  open,
  onClose,
  children,
}: MobileDrawerWrapperProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');

    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      setIsMobile(!e.matches);
    }

    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  // Desktop: render inline (passthrough)
  if (!isMobile) {
    return <>{children}</>;
  }

  // Mobile: full-screen overlay
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col bg-bg">
        {/* Close header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold text-white">Process</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-white"
            aria-label="Close process drawer"
          >
            <X className="size-5" />
          </button>
        </div>
        {/* Drawer content -- override width to full */}
        <div className="flex-1 overflow-y-auto [&>div]:w-full [&>div]:border-l-0">
          {children}
        </div>
      </div>
    </div>
  );
}
