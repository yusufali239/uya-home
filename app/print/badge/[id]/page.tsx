import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgePrinter } from '@/components/BadgePrinter';
import { isStaff, requireUser } from '@/lib/auth';
import { one } from '@/lib/format';
import type { BadgeData } from '@/lib/print/badgeCanvas';
import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/lib/types';

export const metadata: Metadata = { title: 'Бейджик' };
export const dynamic = 'force-dynamic';

type OrderForBadge = Order & {
  products: { name: string; sku: string; color: string | null; dimensions: string | null; brand_photo_url: string | null } | null;
};

/**
 * Бейджик клиента для термопринтера Xprinter XP-365B (бумага 80 мм).
 * Ширина бейджика 76 мм с полями. Печать по Bluetooth (Web Bluetooth)
 * или через системный диалог window.print().
 */
export default async function BadgePage({ params }: { params: { id: string } }) {
  const profile = await requireUser();

  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, products(name, sku, color, dimensions, brand_photo_url)')
    .eq('id', params.id)
    .maybeSingle();
  if (!data) notFound();

  const order = { ...data, products: one(data.products) } as OrderForBadge;

  const badge: BadgeData = {
    orderNumber: order.order_number,
    productName: order.products?.name ?? '—',
    sku: order.products?.sku ?? '—',
    color: order.products?.color ?? null,
    dimensions: order.products?.dimensions ?? null,
    quantity: order.quantity,
    photoUrl: order.products?.brand_photo_url ?? null,
    clientName: order.client_name,
    clientPhone: order.client_phone,
    clientAddress: order.client_address,
    createdAt: order.created_at,
  };

  return <BadgePrinter data={badge} backHref={isStaff(profile) ? '/admin/orders' : `/master/order/${order.id}`} />;
}
