'use client';

import { twoFactor } from '@/lib/auth-client';
import { useState } from 'react';
import QRCode from 'qrcode';

type Step = 'password' | 'qr' | 'verify';

export default function MFASetupPage() {
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: err } = await twoFactor.enable({ password });

      if (err) {
        setError(err.message ?? 'Failed to enable MFA');
        setLoading(false);
        return;
      }

      if (data?.totpURI) {
        const qr = await QRCode.toDataURL(data.totpURI);
        setQrDataUrl(qr);
        setBackupCodes(data.backupCodes ?? []);
        setStep('qr');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: err } = await twoFactor.verifyTotp({ code: verifyCode });

      if (err) {
        setError(err.message ?? 'Invalid verification code');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
        <h1 className="mb-4 text-2xl font-bold text-white">MFA Enabled</h1>
        <p className="mb-6 text-gray-400">
          Two-factor authentication has been enabled successfully.
        </p>
        <a
          href="/"
          className="block w-full rounded-lg bg-accent py-2.5 text-center font-semibold text-bg hover:bg-accent/90"
        >
          Go to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
      <h1 className="mb-1 text-2xl font-bold text-white">
        Set up two-factor authentication
      </h1>
      <p className="mb-6 text-gray-400">
        Add an extra layer of security to your account.
      </p>

      {step === 'password' && (
        <form onSubmit={handleEnable} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">
              Confirm your password
            </label>
            <input
              type="password"
              required
              placeholder="Current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-bg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-accent focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 font-semibold text-bg hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? 'Enabling...' : 'Enable MFA'}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}

      {step === 'qr' && (
        <div className="space-y-6">
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR Code for authenticator app"
              className="rounded-lg"
              width={200}
              height={200}
            />
          </div>

          <p className="text-sm text-gray-400">
            Scan this QR code with your authenticator app (Google Authenticator,
            Authy, 1Password, etc.)
          </p>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-white">
              Backup Codes
            </h2>
            <p className="mb-3 text-xs text-yellow-400">
              Save these backup codes in a safe place. They won&apos;t be shown
              again.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-bg p-4">
              {backupCodes.map((code) => (
                <code key={code} className="text-sm text-gray-300 font-mono">
                  {code}
                </code>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('verify')}
            className="w-full rounded-lg bg-accent py-2.5 font-semibold text-bg hover:bg-accent/90"
          >
            I&apos;ve saved my backup codes
          </button>
        </div>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">
              Enter the 6-digit code from your authenticator app
            </label>
            <input
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-white/10 bg-bg px-4 py-2.5 text-center text-2xl tracking-widest text-white placeholder:text-gray-500 focus:border-accent focus:outline-none font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading || verifyCode.length !== 6}
            className="w-full rounded-lg bg-accent py-2.5 font-semibold text-bg hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify and enable'}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </div>
  );
}
