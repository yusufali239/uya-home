'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Подписка на изменения заказов и партий через Supabase Realtime:
 * новая задача появляется на телефоне мастера без перезагрузки.
 */
export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Несколько событий подряд (заказ + списание) → одно обновление
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel('master-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cut_batches' }, refresh)
      .subscribe();

    // Вернулись в приложение из фона — обновим на всякий случай
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
