import { SupplyCard } from '@/components/SupplyCard';
import { SupplyCreateForm } from '@/components/SupplyCreateForm';
import { formatDateTime, formatQty } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { Supply, SupplyMovement } from '@/lib/types';

type MovementRow = SupplyMovement & { supplies: { name: string; unit: string } | null };

/**
 * Мелочи склада: евровинты, шканты, кромка, клей…
 * Мастер сам заводит позиции и отмечает приход/расход. Персонал видит журнал.
 */
export async function SuppliesBoard({ canDelete, showHistory }: { canDelete: boolean; showHistory: boolean }) {
  const supabase = createClient();
  const [{ data: suppliesRaw }, { data: movementsRaw }, { data: profiles }] = await Promise.all([
    supabase.from('supplies').select('*').order('name'),
    showHistory
      ? supabase.from('supply_movements').select('*, supplies(name, unit)').order('created_at', { ascending: false }).limit(40)
      : Promise.resolve({ data: [] }),
    showHistory ? supabase.from('profiles').select('id, full_name') : Promise.resolve({ data: [] }),
  ]);

  const supplies = (suppliesRaw ?? []) as Supply[];
  const movements = (movementsRaw ?? []) as MovementRow[];
  const names = new Map((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));

  // Сначала то, что заканчивается
  const isLow = (s: Supply) => Number(s.min_quantity) > 0 && Number(s.quantity) < Number(s.min_quantity);
  supplies.sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name, 'ru'));
  const lowCount = supplies.filter(isLow).length;

  return (
    <div className="space-y-4">
      {lowCount > 0 && (
        <div className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">Заканчивается позиций: {lowCount}</div>
      )}

      <SupplyCreateForm />

      {supplies.length === 0 ? (
        <div className="card py-10 text-center text-gray-500">Пока пусто. Добавьте первую позицию — например «Евровинт 7×50».</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {supplies.map((s) => (
            <SupplyCard key={s.id} supply={s} low={isLow(s)} canDelete={canDelete} />
          ))}
        </div>
      )}

      {showHistory && movements.length > 0 && (
        <div className="card p-0">
          <h2 className="border-b px-4 py-3 font-semibold">Журнал движения</h2>
          <ul className="divide-y text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2">
                <span className="text-gray-500">{formatDateTime(m.created_at)}</span>
                <span className="font-medium">{m.supplies?.name}</span>
                <span className={Number(m.delta) > 0 ? 'text-emerald-700' : 'text-red-600'}>
                  {Number(m.delta) > 0 ? '+' : ''}
                  {formatQty(m.delta)} {m.supplies?.unit}
                </span>
                <span className="text-gray-500">→ {formatQty(m.quantity_after)}</span>
                {m.note && <span className="text-gray-500">· {m.note}</span>}
                <span className="ml-auto text-gray-400">{m.created_by ? names.get(m.created_by) : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
