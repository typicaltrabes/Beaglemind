'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Loader2 } from 'lucide-react';

interface ShareDialogProps {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShareLinkData {
  id: string;
  token: string;
  url: string;
  expiresAt: string;
}

export function ShareDialog({ runId, open, onOpenChange }: ShareDialogProps) {
  const [link, setLink] = useState<ShareLinkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to generate share link');
      }
      const data: ShareLinkData = await res.json();
      setLink(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  const handleOpenChange = (next: boolean) => {
    if (next && !link && !loading) {
      generateLink();
    }
    if (!next) {
      // Reset state when closing
      setLink(null);
      setError(null);
      setCopied(false);
    }
    onOpenChange(next);
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input text
    }
  };

  const expiryDate = link?.expiresAt
    ? new Date(link.expiresAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Replay</DialogTitle>
          <DialogDescription>
            Anyone with this link can view a read-only replay of this run.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Generating share link...
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {link && (
            <>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link.url}
                  className="flex-1 rounded-md border border-white/10 bg-muted px-3 py-2 text-sm text-foreground outline-none"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy link
                    </>
                  )}
                </Button>
              </div>
              {expiryDate && (
                <p className="text-xs text-muted-foreground">
                  Expires: {expiryDate}
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
