'use client';

import { twoFactor } from '@/lib/auth-client';
import { useState } from 'react';

export default function MFAChallengePage() {
  const [code, setCode] = useState('');
  const [backupMode, setBackupMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: err } = await twoFactor.verifyTotp({
        code,
        trustDevice: true,
      });

      if (err) {
        setError(err.message ?? 'Invalid code. Please try again.');
        setLoading(false);
        return;
      }

      // Full reload to pick up the authenticated session
      window.location.href = '/';
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
      <h1 className="mb-1 text-2xl font-bold text-white">
        Two-factor authentication
      </h1>
      <p className="mb-6 text-gray-400">
        {backupMode
          ? 'Enter one of your backup codes'
          : 'Enter the code from your authenticator app'}
      </p>

      <form onSubmit={handleVerify} className="space-y-4">
        {backupMode ? (
          <div>
            <input
              type="text"
              required
              placeholder="Backup code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-bg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-accent focus:outline-none font-mono"
            />
          </div>
        ) : (
          <div>
            <input
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-white/10 bg-bg px-4 py-2.5 text-center text-2xl tracking-widest text-white placeholder:text-gray-500 focus:border-accent focus:outline-none font-mono"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (!backupMode && code.length !== 6) || (backupMode && code.length === 0)}
          className="w-full rounded-lg bg-accent py-2.5 font-semibold text-bg hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => {
            setBackupMode(!backupMode);
            setCode('');
            setError('');
          }}
          className="text-sm text-gray-400 hover:text-white"
        >
          {backupMode ? 'Use authenticator app' : 'Use a backup code'}
        </button>
      </div>
    </div>
  );
}
