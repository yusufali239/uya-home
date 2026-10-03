import { FinanceEntryForm } from '@/components/FinanceEntryForm';
import { FinanceEntryRow } from '@/components/FinanceEntryRow';
import { requireUser } from '@/lib/auth';
import { computeBalances } from '@/lib/finance';
import { formatMoney } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { FinanceEntry, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Person = Pick<Profile, 'id' | 'full_name' | 'role'>;

/** Деньги мастера: свои расходы и приходы, сколько на руках */
export default async function MasterFinancePage() {
  const me = await requireUser();
  const supabase = createClient();

  // RLS отдаёт мастеру только записи с его участием
  const [{ data: entriesRaw }, { data: profilesRaw }] = await Promise.all([
    supabase.from('finance_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
  ]);
  const entries = (entriesRaw ?? []) as FinanceEntry[];
  const people = (profilesRaw ?? []) as Person[];
  const nameOf = new Map(people.map((p) => [p.id, p.full_name ?? '—']));

  const mine = computeBalances(entries, people).people.find((b) => b.profile.id === me.id);
  const onHands = mine?.onHands ?? 0;
  const pending = entries.filter((e) => e.status === 'pending');

  return (
    <>
      <div className="card p-5 text-center">
        <div className="text-sm text-gray-500">{onHands < 0 ? 'Kompaniya sizga qarzdor' : 'Qoʻlingizdagi kompaniya puli'}</div>
        <div className={`text-4xl font-black ${onHands < 0 ? 'text-red-600' : ''}`}>{formatMoney(Math.abs(onHands))}</div>
        {pending.length > 0 && (
          <div className="mt-2 text-sm text-amber-700">Tasdiq kutmoqda: {pending.length}</div>
        )}
      </div>

      <FinanceEntryForm people={people} selfId={me.id} isStaff={false} />

      <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-gray-500">Mening yozuvlarim</h2>
      <div className="card p-0">
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-500">Hozircha yozuvlar yoʻq</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <FinanceEntryRow
                key={e.id}
                entry={e}
                personName={nameOf.get(e.person_id) ?? '—'}
                toName={e.to_person_id ? nameOf.get(e.to_person_id) : undefined}
                canReview={false}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
