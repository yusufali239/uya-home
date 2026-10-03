import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BatchParts } from '@/components/BatchParts';
import { BATCH_STATUS, formatDateTime } from '@/lib/format';
import { loadBatchParts } from '@/lib/parts';
import { createClient } from '@/lib/supabase/server';
import type { CutBatch, CutBatchItem, ScrapRemnant } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Item = CutBatchItem & { products: { model_id: string; name: string; sku: string; color: string | null } | null };

/** Детали партии для менеджера */
export default async function BatchPage({ params, searchParams }: { params: { id: string }; searchParams: { created?: string } }) {
  const supabase = createClient();
  const [{ data: batch }, { data: items }, { data: remnants }] = await Promise.all([
    supabase.from('cut_batches').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('cut_batch_items').select('*, products(model_id, name, sku, color)').eq('batch_id', params.id),
    supabase.from('scrap_remnants').select('*').eq('batch_id', params.id),
  ]);
  if (!batch) notFound();
  const b = batch as CutBatch;
  const list = (items ?? []) as Item[];
  const parts = await loadBatchParts(list.map((i) => ({ quantity: i.quantity_to_produce, product: i.products })));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/batches" className="text-sm text-brand-600 hover:underline">← Partiyalar</Link>

      {searchParams.created && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
          Partiya yaratildi, ustaga Telegramʼda xabar yuborildi.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">№{b.batch_number} partiya</h1>
        <span className={`badge ${BATCH_STATUS[b.status].className}`}>{BATCH_STATUS[b.status].label}</span>
      </div>

      <div className="card grid gap-2 text-sm sm:grid-cols-2">
        <div>LDSP listlari: <b>{b.ldsp_sheet_count}</b> ta</div>
        <div>Yaratilgan: {formatDateTime(b.created_at)}</div>
        <div>Detallar qabul qilingan: {formatDateTime(b.started_at)}</div>
        <div>Yakunlangan: {formatDateTime(b.completed_at)}</div>
        {b.sketchcut_file_url && (
          <a href={b.sketchcut_file_url} target="_blank" rel="noreferrer" className="font-medium text-brand-600 underline">
            📄 Kesish chizmasi (PDF)
          </a>
        )}
        {b.notes && <div className="sm:col-span-2">Izoh: {b.notes}</div>}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Mahsulot</th>
              <th className="px-4 py-3 text-right">Reja</th>
              <th className="px-4 py-3 text-right">Haqiqatda</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2">
                  {i.products?.name}
                  {i.products?.color && ` · ${i.products.color}`}{' '}
                  <span className="text-xs text-gray-500">{i.products?.sku}</span>
                </td>
                <td className="px-4 py-2 text-right">{i.quantity_to_produce}</td>
                <td className="px-4 py-2 text-right font-semibold">{i.quantity_produced ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BatchParts {...parts} />

      {remnants && remnants.length > 0 && (
        <div className="card text-sm">
          <h2 className="mb-2 font-semibold">Qoldiqlar</h2>
          <ul>
            {(remnants as ScrapRemnant[]).map((r) => (
              <li key={r.id}>• {r.size} {r.color && `(${r.color})`} — {r.quantity} dona</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
