import type { Metadata } from 'next';
import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import { RealtimeRefresh } from '@/components/RealtimeRefresh';
import { isStaff, requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Мастер' };

/** Экран мастера — для телефона, всё крупно */
export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();

  return (
    <div className="mx-auto min-h-screen max-w-lg">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-brand-700 px-4 py-4 text-white shadow">
        <Link href="/master" className="text-2xl font-black tracking-tight">UYA Мастер</Link>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {isStaff(profile) && <Link href="/admin" className="underline">Админка</Link>}
          <form action={signOut}>
            <button className="opacity-80">Выйти</button>
          </form>
        </div>
      </header>
      <main className="space-y-4 p-4 pb-16">{children}</main>
      <RealtimeRefresh />
    </div>
  );
}
