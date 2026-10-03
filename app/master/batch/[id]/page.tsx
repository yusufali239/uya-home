import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BatchActions } from '@/components/BatchActions';
import { BATCH_STATUS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { CutBatch, CutBatchItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Item = CutBatchItem & { products: { name: string; sku: string; color: string | null } | null };

/** Партия глазами мастера */
export default async function MasterBatchPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: batch }, { data: itemsRaw }] = await Promise.all([
    supabase.from('cut_batches').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('cut_batch_items').select('*, products(name, sku, color)').eq('batch_id', params.id),
  ]);
  if (!batch) notFound();

  const b = batch as CutBatch;
  const items = (itemsRaw ?? []) as Item[];

  return (
    <>
      <Link href="/master" className="inline-block py-2 text-lg text-brand-600">← Barcha vazifalar</Link>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-black">№{b.batch_number} partiya</h1>
          <span className={`badge ml-auto text-sm ${BATCH_STATUS[b.status].className}`}>{BATCH_STATUS[b.status].label}</span>
        </div>
        <div className="mt-2 text-xl">
          {b.ldsp_sheet_count} list LDSP
        </div>
        {b.notes && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-900">💬 {b.notes}</p>}

        <ul className="mt-4 divide-y text-lg">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between py-2">
              <span>
                {i.products?.name}
                {i.products?.color && <span className="text-sm text-gray-500"> · {i.products.color}</span>}
              </span>
              <b>{i.quantity_produced ?? i.quantity_to_produce} dona</b>
            </li>
          ))}
        </ul>
      </div>

      {b.sketchcut_file_url ? (
        <a href={`${b.sketchcut_file_url}?download=`} className="btn-secondary btn-xl" target="_blank" rel="noreferrer">
          📄 Kesish chizmasi (PDF)
        </a>
      ) : (
        <p className="text-center text-gray-500">Kesish chizmasi biriktirilmagan</p>
      )}

      <BatchActions
        batchId={b.id}
        status={b.status}
        items={items.map((i) => ({
          id: i.id,
          name: i.products?.name ?? '—',
          planned: i.quantity_to_produce,
          color: i.products?.color ?? '',
        }))}
      />
    </>
  );
}
