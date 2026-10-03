import type { Metadata } from 'next';
import { AccountPanel } from '@/components/AccountPanel';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Profil' };
export const dynamic = 'force-dynamic';

export default async function AdminAccountPage() {
  const profile = await requireUser();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Profil</h1>
      <AccountPanel profile={profile} />
    </div>
  );
}
