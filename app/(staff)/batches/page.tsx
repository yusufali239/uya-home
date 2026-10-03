import type { Metadata } from 'next';
import Link from 'next/link';
import { BATCH_STATUS, formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { CutBatch } from '@/lib/types';

export const metadata: Metadata = { title: 'Kesish partiyalari' };
export const dynamic = 'force-dynamic';

type BatchRow = CutBatch & { cut_batch_items: { quantity_to_produce: number; products: { name: string; color: string | null } | null }[] };

/** /batches — партии раскроя */
export default async function BatchesPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cut_batches')
    .select('*, cut_batch_items(quantity_to_produce, products(name, color))')
    .order('batch_number', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const batches = (data ?? []) as BatchRow[];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Kesish partiyalari</h1>
        <Link href="/batches/new" className="btn-primary ml-auto">Partiya yaratish</Link>
      </div>

      {batches.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">Hozircha partiyalar yoʻq</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {batches.map((b) => (
            <Link key={b.id} href={`/batches/${b.id}`} className="card block transition hover:ring-brand-500/40">
              <div className="flex items-center gap-2">
                <div className="text-lg font-bold">№{b.batch_number} partiya</div>
                <span className={`badge ${BATCH_STATUS[b.status].className}`}>{BATCH_STATUS[b.status].label}</span>
                <div className="ml-auto text-xs text-gray-500">{formatDateTime(b.created_at)}</div>
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {b.ldsp_sheet_count} list LDSP
              </div>
              <ul className="mt-2 text-sm">
                {b.cut_batch_items.map((i, idx) => (
                  <li key={idx}>• {i.products?.name}{i.products?.color && ` (${i.products.color})`} — {i.quantity_to_produce} dona</li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
