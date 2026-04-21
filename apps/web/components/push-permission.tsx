'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { isPushSupported, isSubscribed, subscribeToPush } from '@/lib/push-client';

/**
 * Small banner prompting the user to enable push notifications.
 * Only renders on mobile (md:hidden) and only if push is supported + not already subscribed.
 */
export function PushPermission() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

    isSubscribed().then((subscribed) => {
      if (!subscribed && Notification.permission !== 'denied') {
        setVisible(true);
      }
    });
  }, []);

  if (!visible) return null;

  async function handleEnable() {
    setLoading(true);
    try {
      const ok = await subscribeToPush();
      if (ok) setVisible(false);
    } catch {
      // Permission denied or error -- hide the prompt
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 md:hidden">
      <Bell className="size-4 shrink-0 text-amber-500" />
      <span className="text-sm text-gray-300">Get notified when agents need you</span>
      <button
        type="button"
        onClick={handleEnable}
        disabled={loading}
        className="ml-auto shrink-0 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-black hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? 'Enabling...' : 'Enable'}
      </button>
    </div>
  );
}
