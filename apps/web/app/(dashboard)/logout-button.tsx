'use client';

import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push('/login');
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-400 hover:text-white"
    >
      Sign out
    </button>
  );
}
