'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loadTelegramWebApp, type TelegramWebApp } from '@/lib/telegram/webapp';

/** Главные экраны, где кнопка «Назад» Telegram не нужна */
const ROOTS = new Set(['/admin', '/master', '/tg', '/login']);

/**
 * Внутри Telegram Mini App: разворачивает на весь экран, красит шапку,
 * и включает системную кнопку «Назад» (в Mini App нет кнопки браузера).
 */
export function TelegramShell() {
  const router = useRouter();
  const pathname = usePathname();
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    loadTelegramWebApp().then((tg) => {
      if (!tg) return;
      tg.ready();
      tg.expand();
      try {
        tg.setHeaderColor('#6e4d2e');
        tg.setBackgroundColor('#f6f3ee');
      } catch {
        // старые версии Telegram не умеют менять цвета
      }
      setWebApp(tg);
    });
  }, []);

  useEffect(() => {
    if (!webApp) return;
    const back = () => router.back();
    if (ROOTS.has(pathname)) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
      webApp.BackButton.onClick(back);
    }
    return () => webApp.BackButton.offClick(back);
  }, [webApp, pathname, router]);

  return null;
}
