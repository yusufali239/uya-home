import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddVariantForm } from '@/components/model/AddVariantForm';
import { ModelForm } from '@/components/model/ModelForm';
import { PartsEditor } from '@/components/model/PartsEditor';
import { VariantCard } from '@/components/model/VariantCard';
import { formatMoney, one } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { ProductModel, ProductPart, ProductWithStock } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Карточка модели: общие поля, цвета и детали */
export default async function ModelPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: model }, { data: variantsRaw }, { data: parts }, { data: waiting }] = await Promise.all([
    supabase.from('product_models').select('*').eq('id', params.id).maybeSingle(),
    supabase
      .from('products')
      .select('*, inventory_finished(quantity, location)')
      .eq('model_id', params.id)
      .order('created_at'),
    supabase.from('product_parts').select('*').eq('model_id', params.id).order('sort'),
    supabase
      .from('orders')
      .select('product_id, quantity, products!inner(model_id)')
      .eq('status', 'waiting_production')
      .eq('products.model_id', params.id),
  ]);

  if (!model) notFound();
  const m = model as ProductModel;
  const variants = (variantsRaw ?? []).map((v) => ({
    ...v,
    inventory_finished: one(v.inventory_finished),
  })) as ProductWithStock[];

  const waitingBy = new Map<string, number>();
  for (const o of waiting ?? []) waitingBy.set(o.product_id, (waitingBy.get(o.product_id) ?? 0) + o.quantity);

  const totalStock = variants.reduce((s, v) => s + (v.inventory_finished?.quantity ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Ombor</Link>

      <div className="flex flex-wrap items-center gap-4">
        {m.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photo_url} alt={m.name} className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/10" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{m.name}</h1>
          <p className="text-sm text-gray-500">
            {[m.dimensions, formatMoney(m.price), `${variants.length} ta rang`, `jami omborda: ${totalStock}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Ranglar</h2>
        {/* key: после сохранения форма пересоздаётся с актуальными значениями */}
        {variants.map((v) => (
          <VariantCard
            key={`${v.id}-${v.inventory_finished?.quantity}-${v.inventory_finished?.location}-${v.min_quantity}`}
            variant={v}
            waiting={waitingBy.get(v.id) ?? 0}
          />
        ))}
        <AddVariantForm modelId={m.id} />
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Detallar</h2>
          <p className="text-sm text-gray-500">
            1 dona mahsulot uchun LDSPdan kesiladigan detallar. Barcha ranglar uchun bir xil — usta partiyada umumiy roʻyxatni koʻradi.
          </p>
        </div>
        <PartsEditor modelId={m.id} parts={(parts ?? []) as ProductPart[]} />
      </section>

      <ModelForm model={m} />
    </div>
  );
}
