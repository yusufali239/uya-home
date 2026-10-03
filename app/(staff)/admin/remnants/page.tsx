import type { Metadata } from 'next';
import { consumeRemnant } from '@/app/actions/remnants';
import { RemnantForm } from '@/components/RemnantForm';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { ScrapRemnant } from '@/lib/types';

export const metadata: Metadata = { title: 'Обрезки' };
export const dynamic = 'force-dynamic';

/** Деловые обрезки ЛДСП — чтобы использовать их в следующих раскроях */
export default async function RemnantsPage() {
  const supabase = createClient();
  const { data } = await supabase.from('scrap_remnants').select('*').order('created_at', { ascending: false });
  const remnants = (data ?? []) as ScrapRemnant[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Обрезки ЛДСП</h1>
      <RemnantForm />

      {remnants.length === 0 ? (
        <div className="card py-10 text-center text-gray-500">Обрезков нет</div>
      ) : (
        <div className="card divide-y p-0">
          {remnants.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <div className="font-semibold">{r.size} мм</div>
                <div className="text-xs text-gray-500">{r.color ?? 'цвет не указан'} · {formatDateTime(r.created_at)}</div>
              </div>
              <div className="text-lg font-bold">{r.quantity} шт.</div>
              <form action={consumeRemnant.bind(null, r.id)}>
                <button className="btn-secondary px-3 py-1.5 text-sm">Использован −1</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
