import 'server-only';
import { APP_URL, masterChatIds } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBot } from '@/lib/telegram/bot';

interface NotificationRow {
  id: string;
  type: 'low_stock' | 'order_ready' | 'batch_created' | 'order_waiting';
  message: string;
  order_id: string | null;
  batch_id: string | null;
  attempts: number;
  created_at: string;
}

/** Ссылка на нужный экран приложения под сообщением */
function linkFor(n: NotificationRow): string | null {
  if (!APP_URL) return null;
  switch (n.type) {
    case 'order_ready':
      return n.order_id ? `${APP_URL}/master/order/${n.order_id}` : null;
    case 'batch_created':
      return n.batch_id ? `${APP_URL}/master/batch/${n.batch_id}` : null;
    case 'low_stock':
    case 'order_waiting':
      return `${APP_URL}/batches/new`;
  }
}

/**
 * Отправляет в Telegram все накопившиеся уведомления.
 *
 * Уведомления создаются в БД триггерами (низкий остаток, заказ к отгрузке,
 * новая партия) и лежат в таблице notifications. Здесь мы атомарно
 * «забираем» пачку (claim_notifications) и рассылаем мастеру.
 * При ошибке — возвращаем в очередь (до 5 попыток).
 *
 * Никогда не бросает исключение: Telegram не должен ломать создание заказа.
 */
export async function flushNotifications(): Promise<{ sent: number; failed: number }> {
  const chatIds = masterChatIds();
  if (!process.env.TELEGRAM_BOT_TOKEN || chatIds.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Бот не настроен — уведомления остаются в очереди до настройки
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('claim_notifications', { p_limit: 20 });
    if (error) throw error;

    const rows = ((data ?? []) as NotificationRow[]).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    const telegram = getBot().telegram;

    for (const n of rows) {
      const link = linkFor(n);
      const text = link ? `${n.message}\n\n👉 ${link}` : n.message;

      try {
        for (const chatId of chatIds) {
          await telegram.sendMessage(chatId, text, { link_preview_options: { is_disabled: true } });
        }
        sent++;
      } catch (err) {
        failed++;
        // Возвращаем в очередь — попробуем при следующем вызове / по cron
        await supabase
          .from('notifications')
          .update({ sent_at: null, last_error: String(err).slice(0, 500) })
          .eq('id', n.id);
      }
    }
  } catch (err) {
    console.error('[telegram] Ошибка отправки уведомлений:', err);
  }

  return { sent, failed };
}
