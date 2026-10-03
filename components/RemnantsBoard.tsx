import { consumeRemnant } from '@/app/actions/remnants';
import { RemnantForm } from '@/components/RemnantForm';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { ScrapRemnant } from '@/lib/types';

/**
 * Деловые обрезки ЛДСП — чтобы использовать их в следующих раскроях.
 * Ведут мастера: добавляют после резки и списывают, когда пустили в дело.
 */
export async function RemnantsBoard() {
  const supabase = createClient();
  const { data } = await supabase.from('scrap_remnants').select('*').order('created_at', { ascending: false });
  const remnants = (data ?? []) as ScrapRemnant[];
  const total = remnants.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="space-y-4">
      <RemnantForm />

      {remnants.length === 0 ? (
        <div className="card py-10 text-center text-gray-500">Qoldiqlar yoʻq</div>
      ) : (
        <>
          <p className="text-sm text-gray-500">Jami: {total} dona</p>
          <div className="card divide-y p-0">
            {remnants.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold">{r.size} mm</div>
                  <div className="text-xs text-gray-500">
                    {r.color ?? 'rangi koʻrsatilmagan'} · {formatDateTime(r.created_at)}
                  </div>
                </div>
                <div className="text-lg font-bold">{r.quantity} dona</div>
                <form action={consumeRemnant.bind(null, r.id)}>
                  <button className="btn-secondary px-3 py-2 text-sm">Ishlatildi −1</button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
