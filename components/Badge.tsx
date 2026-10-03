import { formatDateTime } from '@/lib/format';
import type { Order } from '@/lib/types';

export type OrderForBadge = Order & {
  products: { name: string; sku: string; color: string | null; dimensions: string | null; brand_photo_url: string | null } | null;
};

/** Макет бейджика A6 (105×148 мм). Размеры — в миллиметрах, чтобы печать совпадала с экраном. */
export function Badge({ order, qrSvg }: { order: OrderForBadge; qrSvg: string }) {
  const product = order.products;

  return (
    <div className="sheet-wrap flex justify-center bg-gray-200 p-4 print:bg-white">
      <article
        className="sheet flex flex-col overflow-hidden bg-white text-black shadow-xl"
        style={{ width: '105mm', height: '148mm', padding: '6mm', boxSizing: 'border-box', breakInside: 'avoid' }}
      >
        {/* Шапка */}
        <header className="flex items-center justify-between border-b-2 border-black pb-[2mm]">
          <div style={{ fontSize: '6mm', lineHeight: 1 }} className="font-black tracking-tight">
            UYA HOME
          </div>
          <div className="rounded bg-black px-[2mm] py-[1mm] font-bold text-white" style={{ fontSize: '4mm' }}>
            №{order.order_number}
          </div>
        </header>

        {/* Товар */}
        <section className="mt-[3mm] flex gap-[3mm]">
          <div
            className="flex shrink-0 items-center justify-center overflow-hidden rounded border border-gray-300 bg-gray-50"
            style={{ width: '32mm', height: '32mm' }}
          >
            {product?.brand_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.brand_photo_url} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-gray-400" style={{ fontSize: '3mm' }}>нет фото</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black leading-tight" style={{ fontSize: '6.5mm' }}>
              {product?.name}
            </div>
            <div className="mt-[1mm] font-mono font-bold" style={{ fontSize: '4mm' }}>
              Код: {product?.sku}
            </div>
            <div className="mt-[1mm] text-gray-700" style={{ fontSize: '3.2mm' }}>
              {[product?.color, product?.dimensions].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-[1mm] font-bold" style={{ fontSize: '4mm' }}>
              Кол-во: {order.quantity} шт.
            </div>
          </div>
        </section>

        {/* Получатель */}
        <section className="mt-[3mm] flex-1 border-t-2 border-dashed border-gray-400 pt-[2.5mm]">
          <div className="font-semibold uppercase tracking-widest text-gray-500" style={{ fontSize: '2.8mm' }}>
            Получатель
          </div>
          <div className="mt-[1mm] font-black leading-tight" style={{ fontSize: '6mm' }}>
            {order.client_name}
          </div>
          <div className="mt-[1mm] font-bold" style={{ fontSize: '5mm' }}>
            ☎ {order.client_phone}
          </div>
          <div className="mt-[1.5mm] leading-snug" style={{ fontSize: '4mm' }}>
            {order.client_address}
          </div>
        </section>

        {/* QR + номер */}
        <footer className="flex items-end gap-[3mm] border-t-2 border-black pt-[2.5mm]">
          <div className="qr shrink-0" style={{ width: '24mm', height: '24mm' }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="flex-1">
            <div className="text-gray-500" style={{ fontSize: '2.8mm' }}>Номер заказа</div>
            <div className="font-black leading-none" style={{ fontSize: '8mm' }}>
              {order.order_number}
            </div>
            <div className="mt-[1mm] text-gray-500" style={{ fontSize: '2.8mm' }}>
              {formatDateTime(order.created_at)}
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}
