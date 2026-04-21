import Link from 'next/link';

export default function NoOrgPage() {
  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
      <h1 className="mb-2 text-2xl font-bold text-white">No Organization</h1>
      <p className="mb-6 text-gray-400">
        You are not a member of any organization. Please contact your
        administrator for an invitation.
      </p>
      <Link
        href="/login"
        className="text-sm text-accent hover:text-accent/80"
      >
        Back to sign in
      </Link>
    </div>
  );
}
