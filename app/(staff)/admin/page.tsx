import Link from 'next/link';
import { StockStatus } from '@/components/StockStatus';
import { formatMoney, one } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { ProductWithStock } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** /admin — склад готовой продукции */
export default async function AdminPage() {
  const supabase = createClient();

  const [{ data: productsRaw, error }, { data: waiting }] = await Promise.all([
    supabase.from('products').select('*, inventory_finished(quantity, location), product_models(photo_url)').order('name'),
    supabase.from('orders').select('product_id, quantity').eq('status', 'waiting_production'),
  ]);

  if (error) throw new Error(error.message);

  const products = (productsRaw ?? []).map((p) => ({
    ...p,
    inventory_finished: one(p.inventory_finished),
  })) as (ProductWithStock & { product_models: { photo_url: string | null } | null })[];

  // Сколько штук ждут производства по каждому цвету
  const waitingByProduct = new Map<string, number>();
  for (const o of waiting ?? []) {
    waitingByProduct.set(o.product_id, (waitingByProduct.get(o.product_id) ?? 0) + o.quantity);
  }

  const stockOf = (p: ProductWithStock) => p.inventory_finished?.quantity ?? 0;
  const isLow = (p: ProductWithStock) => stockOf(p) < p.min_quantity;

  // Группируем цвета по моделям
  const models = new Map<string, { id: string; name: string; photo: string | null; variants: typeof products }>();
  for (const p of products) {
    const m = models.get(p.model_id) ?? {
      id: p.model_id,
      name: p.name,
      photo: one(p.product_models)?.photo_url ?? null,
      variants: [],
    };
    m.variants.push(p);
    models.set(p.model_id, m);
  }
  // Сначала модели, где какой-то цвет заканчивается
  const groups = [...models.values()].sort((a, b) => {
    const aLow = a.variants.some(isLow) ? 0 : 1;
    const bLow = b.variants.some(isLow) ? 0 : 1;
    return aLow - bLow || a.name.localeCompare(b.name, 'ru');
  });
  for (const g of groups) g.variants.sort((a, b) => (a.color ?? '').localeCompare(b.color ?? '', 'ru'));

  const lowCount = products.filter(isLow).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Ombor</h1>
        {lowCount > 0 && (
          <Link href="/batches/new" className="badge bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200">
            Tugayapti: {lowCount} — partiya yaratish →
          </Link>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href="/admin/products/new" className="btn-secondary">+ Yangi mahsulot</Link>
          <Link href="/admin/orders/new" className="btn-primary">+ Yangi buyurtma</Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">
          Hozircha mahsulot yoʻq. «+ Yangi mahsulot» tugmasini bosing.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Rasm</th>
                <th className="px-4 py-3">Model / rang</th>
                <th className="px-4 py-3 text-right">Omborda</th>
                <th className="px-4 py-3 text-right">Minimum</th>
                <th className="px-4 py-3">Holat</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.id} className="border-b-4 border-gray-100 last:border-b-0">
                {g.variants.map((p, i) => {
                  const qty = stockOf(p);
                  const low = isLow(p);
                  const waitingQty = waitingByProduct.get(p.id) ?? 0;
                  const photo = p.brand_photo_url ?? g.photo;
                  return (
                    <tr key={p.id} className={`${i > 0 ? 'border-t border-gray-100' : ''} ${low ? 'bg-red-50/60' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-2">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt={p.name} className="h-12 w-12 rounded-lg object-cover ring-1 ring-black/10" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">yoʻq</div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {i === 0 && (
                          <Link href={`/admin/models/${g.id}`} className="font-semibold hover:underline">
                            {g.name}
                            {g.variants.length > 1 && (
                              <span className="ml-2 text-xs font-normal text-gray-500">{g.variants.length} ta rang</span>
                            )}
                          </Link>
                        )}
                        <Link href={`/admin/models/${g.id}`} className="block text-sm text-gray-700 hover:underline">
                          <span className="font-medium">{p.color || '—'}</span>
                          <span className="text-xs text-gray-500">
                            {' · '}
                            {p.sku}
                            {p.inventory_finished?.location && ` · 📍 ${p.inventory_finished.location}`}
                          </span>
                        </Link>
                        {i === 0 && (
                          <div className="text-xs text-gray-400">
                            {[p.dimensions, formatMoney(p.price)].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-right text-lg font-bold ${low ? 'text-red-600' : ''}`}>
                        {qty}
                        {waitingQty > 0 && (
                          <div className="text-xs font-medium text-amber-700">kutmoqda: {waitingQty}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">{p.min_quantity}</td>
                      <td className="px-4 py-2">
                        <StockStatus quantity={qty} min={p.min_quantity} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
