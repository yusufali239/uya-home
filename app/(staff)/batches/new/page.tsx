import type { Metadata } from 'next';
import Link from 'next/link';
import { BatchForm, type BatchCandidate } from '@/components/BatchForm';
import { one } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Yangi partiya' };
export const dynamic = 'force-dynamic';

export default async function NewBatchPage() {
  const supabase = createClient();
  const [{ data: products }, { data: waiting }] = await Promise.all([
    supabase.from('products').select('id, name, sku, color, min_quantity, inventory_finished(quantity)').order('name').order('color'),
    supabase.from('orders').select('product_id, quantity').eq('status', 'waiting_production'),
  ]);

  const waitingByProduct = new Map<string, number>();
  for (const o of waiting ?? []) {
    waitingByProduct.set(o.product_id, (waitingByProduct.get(o.product_id) ?? 0) + o.quantity);
  }

  const candidates: BatchCandidate[] = (products ?? []).map((p) => {
    const stock = one(p.inventory_finished)?.quantity ?? 0;
    const waitingQty = waitingByProduct.get(p.id) ?? 0;
    // Сколько нужно сделать: закрыть ждущие заказы и добрать склад до минимума
    const suggested = Math.max(1, waitingQty + p.min_quantity - stock);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      color: p.color,
      stock,
      min: p.min_quantity,
      waiting: waitingQty,
      suggested,
      low: stock < p.min_quantity,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/batches" className="text-sm text-brand-600 hover:underline">← Partiyalar</Link>
      <h1 className="text-2xl font-bold">Yangi kesish partiyasi</h1>
      <BatchForm candidates={candidates} />
    </div>
  );
}
