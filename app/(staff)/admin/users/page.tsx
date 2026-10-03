import type { Metadata } from 'next';
import { changeRole } from '@/app/actions/users';
import { UserForm } from '@/components/UserForm';
import { requireRole } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/types';

export const metadata: Metadata = { title: 'Xodimlar' };
export const dynamic = 'force-dynamic';

/** Только для директора: сотрудники и их роли */
export default async function UsersPage() {
  const me = await requireRole(['director']);
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').order('created_at');
  const profiles = (data ?? []) as Profile[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Xodimlar</h1>

      <div className="card divide-y p-0">
        {profiles.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex-1 font-medium">{p.full_name}</div>
            {p.id === me.id ? (
              <span className="text-sm text-gray-500">{ROLE_LABELS[p.role]} (siz)</span>
            ) : (
              <form action={changeRole.bind(null, p.id)} className="flex gap-2">
                <select name="role" defaultValue={p.role} className="input py-1.5 text-sm">
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button className="btn-secondary px-3 py-1.5 text-sm">OK</button>
              </form>
            )}
          </div>
        ))}
      </div>

      <UserForm />
    </div>
  );
}
