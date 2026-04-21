'use client';

import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
      <h1 className="mb-1 text-2xl font-bold text-white">
        Beagle Agent Console
      </h1>
      <p className="mb-6 text-gray-400">
        This application is invite-only. If you&apos;ve received an invitation,
        please use the link in your email.
      </p>
      <Link
        href="/login"
        className="block w-full rounded-lg bg-accent py-2.5 text-center font-semibold text-bg hover:bg-accent/90"
      >
        Back to Sign In
      </Link>
    </div>
  );
}
