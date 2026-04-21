'use client';

import { orgClient } from '@/lib/auth-client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface InvitationData {
  email: string;
  organizationName: string;
  organizationId: string;
  status: string;
}

export default function AcceptInvitePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const invitationId = params.id;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!invitationId) return;

    async function fetchInvitation() {
      try {
        const { data, error } = await orgClient.getInvitation({
          query: { id: invitationId },
        });

        if (error || !data) {
          setInviteError(
            'This invitation is invalid or has expired.',
          );
          setLoadingInvite(false);
          return;
        }

        setInvitation({
          email: data.email,
          organizationName: data.organizationName,
          organizationId: data.organizationId,
          status: data.status,
        });
        setEmail(data.email);
        setLoadingInvite(false);
      } catch {
        setInviteError('Failed to load invitation details.');
        setLoadingInvite(false);
      }
    }

    fetchInvitation();
  }, [invitationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId,
          email,
          password,
          name,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error ?? 'Failed to create account. Please try again.');
        setSubmitting(false);
        return;
      }

      // The API returns Set-Cookie headers that the browser picks up automatically.
      // Redirect to dashboard -- session should be established.
      router.push('/');
    } catch {
      setSubmitError('An unexpected error occurred.');
      setSubmitting(false);
    }
  }

  if (loadingInvite) {
    return (
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
        <p className="text-gray-400">Loading invitation...</p>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
        <h1 className="mb-4 text-2xl font-bold text-white">Invalid Invitation</h1>
        <p className="mb-6 text-gray-400">{inviteError}</p>
        <a
          href="/login"
          className="block w-full rounded-lg bg-accent py-2.5 text-center font-semibold text-bg hover:bg-accent/90"
        >
          Go to Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
      <h1 className="mb-1 text-2xl font-bold text-white">
        Join {invitation?.organizationName}
      </h1>
      <p className="mb-6 text-gray-400">
        Create your account to accept the invitation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-400">Name</label>
          <input
            type="text"
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Email</label>
          <input
            type="email"
            required
            readOnly
            value={email}
            className="w-full rounded-lg border border-white/10 bg-bg/50 px-4 py-2.5 text-gray-400 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Password</label>
          <input
            type="password"
            required
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">
            Confirm Password
          </label>
          <input
            type="password"
            required
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-accent focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent py-2.5 font-semibold text-bg hover:bg-accent/90 disabled:opacity-50"
        >
          {submitting ? 'Creating account...' : 'Create account and join'}
        </button>

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}
      </form>
    </div>
  );
}
