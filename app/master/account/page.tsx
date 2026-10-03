import { AccountPanel } from '@/components/AccountPanel';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MasterAccountPage() {
  const profile = await requireUser();
  return (
    <>
      <h1 className="text-2xl font-bold">Profil</h1>
      <AccountPanel profile={profile} />
    </>
  );
}
