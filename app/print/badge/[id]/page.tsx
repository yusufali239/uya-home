import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { Badge, type OrderForBadge } from '@/components/Badge';
import { PrintToolbar } from '@/components/PrintToolbar';
import { requireUser } from '@/lib/auth';
import { one } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Бейджик' };

/**
 * Бейджик клиента формата A6 (105×148 мм) для печати через window.print().
 * Работает с телефона мастера: Android (Mopria / встроенная служба печати)
 * и iPhone (AirPrint) находят Wi-Fi принтер сами — драйверы не нужны.
 */
export default async function BadgePage({ params, searchParams }: { params: { id: string }; searchParams: { auto?: string } }) {
  await requireUser();

  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, products(name, sku, color, dimensions, brand_photo_url)')
    .eq('id', params.id)
    .maybeSingle();
  if (!data) notFound();

  const order = { ...data, products: one(data.products) } as OrderForBadge;

  // QR с номером заказа — сканируется любым телефоном
  const qrSvg = await QRCode.toString(order.order_number, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });

  return (
    <>
      <style>{`
        @page { size: 105mm 148mm; margin: 0; } /* A6 */
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          html, body { background: #fff !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .sheet-wrap { padding: 0 !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; }
        }
        .qr svg { width: 100%; height: 100%; display: block; }
      `}</style>

      <PrintToolbar auto={searchParams.auto === '1'} backHref={`/master/order/${order.id}`} />

      <Badge order={order} qrSvg={qrSvg} />
    </>
  );
}
