'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Дождаться загрузки всех картинок (фото товара), чтобы не печатать пустой квадрат */
async function waitForImages() {
  const images = Array.from(document.images);
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
    ),
  );
}

async function printBadge() {
  await waitForImages();
  window.print();
}

/** Панель над бейджиком: печать и «назад». При печати скрыта. */
export function PrintToolbar({ auto, backHref }: { auto: boolean; backHref: string }) {
  useEffect(() => {
    if (!auto) return;
    // Небольшая пауза — мобильные браузеры не любят print() сразу при загрузке
    const timer = setTimeout(printBadge, 600);
    return () => clearTimeout(timer);
  }, [auto]);

  return (
    <div className="no-print sticky top-0 z-10 flex items-center gap-3 bg-white p-3 shadow">
      <Link href={backHref} className="btn-secondary">← Назад</Link>
      <button className="btn-primary flex-1 py-3 text-lg" onClick={printBadge}>
        🖨 Печать (A6)
      </button>
    </div>
  );
}
