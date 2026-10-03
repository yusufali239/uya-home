import Link from 'next/link';
import { BATCH_STATUS, formatDateTime, one } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { CutBatch, Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

type OrderTask = Order & { products: { name: string } | null };
type BatchTask = CutBatch & { cut_batch_items: { quantity_to_produce: number }[] };

/** Список задач мастера: партии к раскрою и заказы к отгрузке */
export default async function MasterPage() {
  const supabase = createClient();
  const [{ data: batchesRaw }, { data: ordersRaw }] = await Promise.all([
    supabase
      .from('cut_batches')
      .select('*, cut_batch_items(quantity_to_produce)')
      .in('status', ['planned', 'in_progress'])
      .order('batch_number'),
    supabase
      .from('orders')
      .select('*, products(name)')
      .eq('status', 'ready_to_ship')
      .order('created_at'),
  ]);

  const batches = (batchesRaw ?? []) as BatchTask[];
  const orders = (ordersRaw ?? []).map((o) => ({ ...o, products: one(o.products) })) as OrderTask[];

  if (batches.length === 0 && orders.length === 0) {
    return (
      <div className="card mt-8 py-16 text-center">
        <div className="text-5xl">🎉</div>
        <div className="mt-3 text-xl font-semibold">Vazifalar yoʻq</div>
        <p className="mt-1 text-gray-500">Yangi vazifalar shu yerda avtomatik paydo boʻladi</p>
      </div>
    );
  }

  return (
    <>
      {batches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">🪚 Kesish partiyalari</h2>
          {batches.map((b) => {
            const total = b.cut_batch_items.reduce((s, i) => s + i.quantity_to_produce, 0);
            return (
              <Link key={b.id} href={`/master/batch/${b.id}`} className="card block p-5 active:scale-[0.99]">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">№{b.batch_number} partiya</div>
                  <span className={`badge ml-auto text-sm ${BATCH_STATUS[b.status].className}`}>
                    {BATCH_STATUS[b.status].label}
                  </span>
                </div>
                <div className="mt-1 text-lg text-gray-700">
                  {b.ldsp_sheet_count} list · {total} dona
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {orders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">📦 Joʻnatiladigan buyurtmalar</h2>
          {orders.map((o) => (
            <Link key={o.id} href={`/master/order/${o.id}`} className="card block p-5 active:scale-[0.99]">
              <div className="text-2xl font-bold">№{o.order_number} buyurtma</div>
              <div className="mt-1 text-lg">
                {o.products?.name} × {o.quantity}
              </div>
              <div className="mt-1 text-gray-500">
                {o.client_name} · {formatDateTime(o.created_at)}
              </div>
              <div className="mt-2 font-semibold text-brand-600">Yorliqni chop etish →</div>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
