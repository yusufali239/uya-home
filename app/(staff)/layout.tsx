import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import { StaffNav } from '@/components/StaffNav';
import { requireStaff } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/format';

/** Общий каркас для директора и менеджера */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="text-xl font-black tracking-tight text-brand-700">
            UYA HOME
          </Link>
          <StaffNav isDirector={profile.role === 'director'} />
          <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
            <Link href="/admin/account" className="hidden hover:underline sm:inline">
              {profile.full_name} · {ROLE_LABELS[profile.role]}
            </Link>
            <form action={signOut}>
              <button className="font-medium text-brand-600 hover:underline">Выйти</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
