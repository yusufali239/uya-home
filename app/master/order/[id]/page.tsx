import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShipButton } from '@/components/ShipButton';
import { ORDER_STATUS, one } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

type OrderWithProduct = Order & {
  products: { name: string; sku: string; brand_photo_url: string | null; instruction_url: string | null } | null;
};

/** Заказ глазами мастера: бейджик и отгрузка */
export default async function MasterOrderPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, products(name, sku, brand_photo_url, instruction_url)')
    .eq('id', params.id)
    .maybeSingle();
  if (!data) notFound();

  const order = { ...data, products: one(data.products) } as OrderWithProduct;
  const { data: inventory } = await supabase
    .from('inventory_finished')
    .select('location')
    .eq('product_id', order.product_id)
    .maybeSingle();

  return (
    <>
      <Link href="/master" className="inline-block py-2 text-lg text-brand-600">← Barcha vazifalar</Link>

      <div className="card space-y-3 p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-black">№{order.order_number}</h1>
          <span className={`badge ml-auto text-sm ${ORDER_STATUS[order.status].className}`}>
            {ORDER_STATUS[order.status].label}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {order.products?.brand_photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={order.products.brand_photo_url} alt="" className="h-20 w-20 rounded-xl object-cover" />
          )}
          <div>
            <div className="text-xl font-semibold">{order.products?.name} × {order.quantity}</div>
            <div className="text-gray-500">{order.products?.sku}</div>
            {inventory?.location && <div className="text-lg font-semibold text-brand-700">📍 {inventory.location}</div>}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4 text-lg">
          <div className="font-semibold">{order.client_name}</div>
          <a href={`tel:${order.client_phone}`} className="block text-brand-600">📞 {order.client_phone}</a>
          <div className="text-gray-700">📍 {order.client_address}</div>
        </div>
      </div>

      <Link href={`/print/badge/${order.id}`} className="btn-primary btn-xl">
        🖨 Mijoz yorligʻini chop etish
      </Link>

      {order.products?.instruction_url && (
        <a href={order.products.instruction_url} target="_blank" rel="noreferrer" className="btn-secondary btn-xl">
          📘 Yigʻish yoʻriqnomasi
        </a>
      )}

      {order.status === 'ready_to_ship' && (
        <div>
          <ShipButton orderId={order.id} className="btn-success btn-xl" label="🚚 Joʻnatildi" redirectTo="/master" />
        </div>
      )}
    </>
  );
}
