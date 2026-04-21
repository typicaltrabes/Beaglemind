'use client';

import { signIn } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    await signIn.email(
      {
        email,
        password,
        callbackURL: '/',
      },
      {
        onSuccess: () => {
          router.push('/');
        },
        onError: (ctx) => {
          setError(ctx.error.message ?? 'Sign in failed');
          setLoading(false);
        },
      },
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
      <h1 className="mb-1 text-2xl font-bold text-white">
        Beagle Agent Console
      </h1>
      <p className="mb-6 text-gray-400">Sign in to continue</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <input
            type="password"
            required
            placeholder="Password"
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
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}
