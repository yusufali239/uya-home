import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateProduct } from '@/app/actions/products';
import { ProductForm } from '@/components/ProductForm';
import { StockStatus } from '@/components/StockStatus';
import { one } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { ProductWithStock } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Карточка товара: редактирование и корректировка остатка */
export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('products')
    .select('*, inventory_finished(quantity, location)')
    .eq('id', params.id)
    .maybeSingle();

  if (!data) notFound();
  const product = { ...data, inventory_finished: one(data.inventory_finished) } as ProductWithStock;
  const qty = product.inventory_finished?.quantity ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Склад</Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <StockStatus quantity={qty} min={product.min_quantity} />
      </div>
      {/* key: после сохранения форма пересоздаётся с актуальными значениями */}
      <ProductForm key={`${qty}-${product.inventory_finished?.location}`} action={updateProduct.bind(null, product.id)} product={product} />
    </div>
  );
}
