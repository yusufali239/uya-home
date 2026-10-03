import type { Metadata } from 'next';
import Link from 'next/link';
import { ShipButton } from '@/components/ShipButton';
import { ORDER_STATUS, SOURCE_LABELS, formatDateTime, one } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { Order, OrderStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Заказы' };
export const dynamic = 'force-dynamic';

const FILTERS: { key: string; label: string; statuses: OrderStatus[] | null }[] = [
  { key: 'active', label: 'Активные', statuses: ['new', 'confirmed', 'ready_to_ship', 'waiting_production'] },
  { key: 'ready', label: 'К отгрузке', statuses: ['ready_to_ship'] },
  { key: 'waiting', label: 'Ждут производства', statuses: ['waiting_production'] },
  { key: 'shipped', label: 'Отгружены', statuses: ['shipped'] },
  { key: 'all', label: 'Все', statuses: null },
];

type OrderRow = Order & { products: { name: string; sku: string } | null };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { filter?: string; created?: string; status?: string };
}) {
  const filter = FILTERS.find((f) => f.key === searchParams.filter) ?? FILTERS[0];

  const supabase = createClient();
  let query = supabase
    .from('orders')
    .select('*, products(name, sku)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (filter.statuses) query = query.in('status', filter.statuses);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const orders = (data ?? []).map((o) => ({ ...o, products: one(o.products) })) as OrderRow[];

  const createdStatus = searchParams.status as OrderStatus | undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Заказы</h1>
        <Link href="/admin/orders/new" className="btn-primary ml-auto">+ Новый заказ</Link>
      </div>

      {searchParams.created && createdStatus && (
        <div
          className={`rounded-xl px-4 py-3 font-medium ${
            createdStatus === 'ready_to_ship' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
          }`}
        >
          Заказ №{searchParams.created} создан.{' '}
          {createdStatus === 'ready_to_ship'
            ? 'Товар есть на складе — мастер получил задание на отправку.'
            : 'Товара не хватает — заказ ждёт производства. Создайте партию раскроя.'}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/orders?filter=${f.key}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              f.key === filter.key ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">Заказов нет</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">№</th>
                <th className="px-4 py-3">Товар</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Источник</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{o.order_number}</div>
                    <div className="text-xs text-gray-500">{formatDateTime(o.created_at)}</div>
                  </td>
                  <td className="px-4 py-3">
                    {o.products?.name ?? '—'} × {o.quantity}
                    <div className="text-xs text-gray-500">{o.products?.sku}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.client_name}</div>
                    <a href={`tel:${o.client_phone}`} className="text-xs text-brand-600">{o.client_phone}</a>
                    <div className="max-w-[16rem] text-xs text-gray-500">{o.client_address}</div>
                  </td>
                  <td className="px-4 py-3">{SOURCE_LABELS[o.source]}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ORDER_STATUS[o.status].className}`}>{ORDER_STATUS[o.status].label}</span>
                  </td>
                  <td className="space-y-1 px-4 py-3 text-right">
                    <Link href={`/print/badge/${o.id}`} target="_blank" className="block text-sm text-brand-600 hover:underline">
                      Бейджик
                    </Link>
                    {o.status === 'ready_to_ship' && <ShipButton orderId={o.id} className="btn-success px-3 py-1.5 text-sm" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
