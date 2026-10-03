import type { Metadata } from 'next';
import Link from 'next/link';
import { FinanceEntryForm } from '@/components/FinanceEntryForm';
import { FinanceEntryRow } from '@/components/FinanceEntryRow';
import { requireStaff } from '@/lib/auth';
import { computeBalances } from '@/lib/finance';
import { FINANCE_KIND, ROLE_LABELS, formatMoney } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { FinanceEntry, FinanceKind, Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Бухгалтерия' };
export const dynamic = 'force-dynamic';

type Person = Pick<Profile, 'id' | 'full_name' | 'role'>;

/** Бухгалтерия: деньги компании, у кого сколько на руках, подтверждение записей мастера */
export default async function FinancePage({ searchParams }: { searchParams: { person?: string; kind?: string } }) {
  const me = await requireStaff();
  const supabase = createClient();

  const [{ data: entriesRaw }, { data: profilesRaw }] = await Promise.all([
    supabase.from('finance_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
  ]);
  const entries = (entriesRaw ?? []) as FinanceEntry[];
  const people = (profilesRaw ?? []) as Person[];
  const nameOf = new Map(people.map((p) => [p.id, p.full_name ?? '—']));

  const { people: balances, companyTotal, totalIncome, totalExpense } = computeBalances(entries, people);

  // Текущий месяц (по Бишкеку)
  const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bishkek' }).slice(0, 7);
  const monthApproved = entries.filter((e) => e.status === 'approved' && e.entry_date.startsWith(month));
  const monthIncome = monthApproved.filter((e) => e.kind === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const monthExpense = monthApproved.filter((e) => e.kind === 'expense').reduce((s, e) => s + Number(e.amount), 0);

  const pendingEntries = entries.filter((e) => e.status === 'pending');

  const kindFilter = searchParams.kind as FinanceKind | undefined;
  const filtered = entries
    .filter((e) => !searchParams.person || e.person_id === searchParams.person || e.to_person_id === searchParams.person)
    .filter((e) => !kindFilter || e.kind === kindFilter)
    .slice(0, 150);

  const filterHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { person: searchParams.person, kind: searchParams.kind, ...patch };
    Object.entries(next).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return `/admin/finance${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Бухгалтерия</h1>

      {/* Сводка */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="text-sm text-gray-500">Деньги компании</div>
          <div className={`text-3xl font-black ${companyTotal < 0 ? 'text-red-600' : ''}`}>{formatMoney(companyTotal)}</div>
          <div className="mt-1 text-xs text-gray-500">приход {formatMoney(totalIncome)} − расход {formatMoney(totalExpense)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Приход за месяц</div>
          <div className="text-2xl font-bold text-emerald-700">+ {formatMoney(monthIncome)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Расход за месяц</div>
          <div className="text-2xl font-bold text-red-600">− {formatMoney(monthExpense)}</div>
        </div>
      </div>

      {/* Ждут подтверждения */}
      {pendingEntries.length > 0 && (
        <div className="card p-0 ring-2 ring-amber-300">
          <h2 className="border-b bg-amber-50 px-4 py-3 font-semibold text-amber-900">
            Ждут подтверждения: {pendingEntries.length}
          </h2>
          <ul className="divide-y">
            {pendingEntries.map((e) => (
              <FinanceEntryRow
                key={e.id}
                entry={e}
                personName={nameOf.get(e.person_id) ?? '—'}
                toName={e.to_person_id ? nameOf.get(e.to_person_id) : undefined}
                canReview
              />
            ))}
          </ul>
        </div>
      )}

      {/* У кого сколько */}
      <div className="card overflow-x-auto p-0">
        <h2 className="border-b px-4 py-3 font-semibold">По сотрудникам</h2>
        {balances.length === 0 ? (
          <p className="px-4 py-6 text-center text-gray-500">Подтверждённых записей пока нет</p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Сотрудник</th>
                <th className="px-4 py-2 text-right">Приход</th>
                <th className="px-4 py-2 text-right">Расход</th>
                <th className="px-4 py-2 text-right">Передал / получил</th>
                <th className="px-4 py-2 text-right">На руках</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {balances.map((b) => (
                <tr key={b.profile.id}>
                  <td className="px-4 py-2">
                    <Link href={filterHref({ person: b.profile.id })} className="font-medium hover:underline">
                      {b.profile.full_name}
                    </Link>
                    <div className="text-xs text-gray-500">{ROLE_LABELS[b.profile.role]}</div>
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-700">{formatMoney(b.income)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{formatMoney(b.expense)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    −{formatMoney(b.given)} / +{formatMoney(b.received)}
                  </td>
                  <td className={`px-4 py-2 text-right text-base font-bold ${b.onHands < 0 ? 'text-red-600' : ''}`}>
                    {formatMoney(b.onHands)}
                    {b.onHands < 0 && <div className="text-xs font-normal">компания должна</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="border-t px-4 py-2 text-xs text-gray-500">
          «На руках» = приход − расход − передал + получил. Плюс — у сотрудника деньги компании, минус — он потратил свои и компания ему должна.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div>
          <h2 className="mb-2 font-semibold">Новая запись</h2>
          <FinanceEntryForm people={people} selfId={me.id} isStaff />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-semibold">Журнал</h2>
            {(['income', 'expense', 'transfer'] as FinanceKind[]).map((k) => (
              <Link
                key={k}
                href={filterHref({ kind: kindFilter === k ? undefined : k })}
                className={`rounded-full px-3 py-1 text-sm ring-1 ${kindFilter === k ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-gray-300'}`}
              >
                {FINANCE_KIND[k].label}
              </Link>
            ))}
            {(searchParams.person || kindFilter) && (
              <Link href="/admin/finance" className="text-sm text-gray-500 underline">
                сбросить{searchParams.person ? ` (${nameOf.get(searchParams.person)})` : ''}
              </Link>
            )}
          </div>
          <div className="card p-0">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-gray-500">Записей нет</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((e) => (
                  <FinanceEntryRow
                    key={e.id}
                    entry={e}
                    personName={nameOf.get(e.person_id) ?? '—'}
                    toName={e.to_person_id ? nameOf.get(e.to_person_id) : undefined}
                    canReview
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
