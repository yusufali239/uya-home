import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderForm, type OrderProductOption } from '@/components/OrderForm';
import { one } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Yangi buyurtma' };
export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('products')
    .select('id, name, sku, color, inventory_finished(quantity)')
    .order('name');

  const products: OrderProductOption[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    color: p.color,
    stock: one(p.inventory_finished)?.quantity ?? 0,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin/orders" className="text-sm text-brand-600 hover:underline">← Buyurtmalar</Link>
      <h1 className="text-2xl font-bold">Yangi buyurtma</h1>
      {products.length === 0 ? (
        <div className="card text-gray-500">
          Avval mahsulot qoʻshing: <Link href="/admin/products/new" className="text-brand-600 underline">+ Yangi mahsulot</Link>
        </div>
      ) : (
        <OrderForm products={products} />
      )}
    </div>
  );
}
