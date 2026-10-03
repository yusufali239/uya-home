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
    supabase.from('products').select('*, inventory_finished(quantity, location)').order('name'),
    supabase.from('orders').select('product_id, quantity').eq('status', 'waiting_production'),
  ]);

  if (error) throw new Error(error.message);

  const products = (productsRaw ?? []).map((p) => ({
    ...p,
    inventory_finished: one(p.inventory_finished),
  })) as ProductWithStock[];

  // Сколько штук ждут производства по каждому товару
  const waitingByProduct = new Map<string, number>();
  for (const o of waiting ?? []) {
    waitingByProduct.set(o.product_id, (waitingByProduct.get(o.product_id) ?? 0) + o.quantity);
  }

  // Сначала то, что заканчивается
  const stockOf = (p: ProductWithStock) => p.inventory_finished?.quantity ?? 0;
  products.sort((a, b) => {
    const aLow = stockOf(a) < a.min_quantity ? 0 : 1;
    const bLow = stockOf(b) < b.min_quantity ? 0 : 1;
    return aLow - bLow || a.name.localeCompare(b.name, 'ru');
  });

  const lowCount = products.filter((p) => stockOf(p) < p.min_quantity).length;

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

      {products.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">
          Hozircha mahsulot yoʻq. «+ Yangi mahsulot» tugmasini bosing.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Rasm</th>
                <th className="px-4 py-3">Nomi</th>
                <th className="px-4 py-3 text-right">Omborda</th>
                <th className="px-4 py-3 text-right">Minimum</th>
                <th className="px-4 py-3">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => {
                const qty = stockOf(p);
                const low = qty < p.min_quantity;
                const waitingQty = waitingByProduct.get(p.id) ?? 0;
                return (
                  <tr key={p.id} className={low ? 'bg-red-50/60' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2">
                      {p.brand_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.brand_photo_url} alt={p.name} className="h-12 w-12 rounded-lg object-cover ring-1 ring-black/10" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">yoʻq</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/admin/products/${p.id}`} className="font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {[p.sku, p.color, p.dimensions].filter(Boolean).join(' · ')}
                        {p.inventory_finished?.location && ` · 📍 ${p.inventory_finished.location}`}
                      </div>
                      <div className="text-xs text-gray-400">{formatMoney(p.price)}</div>
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
          </table>
        </div>
      )}
    </div>
  );
}
