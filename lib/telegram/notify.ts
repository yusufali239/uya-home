import 'server-only';
import { APP_URL, masterChatIds } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBot } from '@/lib/telegram/bot';

type NotificationType = 'low_stock' | 'order_ready' | 'batch_created' | 'order_waiting' | 'supply_low' | 'finance_pending';

interface NotificationRow {
  id: string;
  type: NotificationType;
  message: string;
  order_id: string | null;
  batch_id: string | null;
  attempts: number;
  created_at: string;
}

type Audience = 'master' | 'staff' | 'all';

/** Кому что отправлять */
const AUDIENCE: Record<NotificationType, Audience> = {
  order_ready: 'master',     // отгрузить заказ
  batch_created: 'master',   // резать партию
  low_stock: 'all',          // готовая продукция заканчивается
  order_waiting: 'all',      // заказ ждёт производства
  supply_low: 'all',         // мелочи заканчиваются
  finance_pending: 'staff',  // мастер внёс расход/приход — подтвердить
};

/** Экран приложения, который открывает кнопка под сообщением */
function pathFor(n: NotificationRow): string {
  switch (n.type) {
    case 'order_ready':
      return n.order_id ? `/master/order/${n.order_id}` : '/master';
    case 'batch_created':
      return n.batch_id ? `/master/batch/${n.batch_id}` : '/master';
    case 'low_stock':
    case 'order_waiting':
      return '/batches/new';
    case 'supply_low':
      return '/master/supplies';
    case 'finance_pending':
      return '/admin/finance';
  }
}

/**
 * Получатели: chat_id из TELEGRAM_MASTER_CHAT_ID (считаются мастерами)
 * + сотрудники, привязавшие Telegram в Mini App, по их роли.
 */
async function loadRecipients(): Promise<Record<'master' | 'staff', Set<string>>> {
  const master = new Set(masterChatIds());
  const staff = new Set<string>();

  const { data } = await createAdminClient().from('profiles').select('role, telegram_id').not('telegram_id', 'is', null);
  for (const p of data ?? []) {
    (p.role === 'master' ? master : staff).add(String(p.telegram_id));
  }
  return { master, staff };
}

/**
 * Отправляет в Telegram все накопившиеся уведомления.
 *
 * Уведомления создаются в БД триггерами и функциями и лежат в таблице
 * notifications. Здесь мы атомарно «забираем» пачку (claim_notifications)
 * и рассылаем адресатам. При ошибке — возвращаем в очередь (до 5 попыток).
 *
 * Никогда не бросает исключение: Telegram не должен ломать создание заказа.
 */
export async function flushNotifications(): Promise<{ sent: number; failed: number }> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Бот не настроен — уведомления остаются в очереди до настройки
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  try {
    const recipients = await loadRecipients();
    if (recipients.master.size === 0 && recipients.staff.size === 0) return { sent, failed };

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('claim_notifications', { p_limit: 20 });
    if (error) throw error;

    const rows = ((data ?? []) as NotificationRow[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const telegram = getBot().telegram;
    // Кнопка Mini App работает только по https
    const webAppButtons = APP_URL.startsWith('https://');

    for (const n of rows) {
      const audience = AUDIENCE[n.type] ?? 'all';
      const chatIds = new Set<string>([
        ...(audience !== 'staff' ? recipients.master : []),
        ...(audience !== 'master' ? recipients.staff : []),
      ]);
      const path = pathFor(n);

      try {
        for (const chatId of chatIds) {
          if (webAppButtons) {
            await telegram.sendMessage(chatId, n.message, {
              reply_markup: {
                inline_keyboard: [[{ text: 'Открыть', web_app: { url: `${APP_URL}/tg?next=${encodeURIComponent(path)}` } }]],
              },
            });
          } else {
            await telegram.sendMessage(chatId, APP_URL ? `${n.message}\n\n👉 ${APP_URL}${path}` : n.message, {
              link_preview_options: { is_disabled: true },
            });
          }
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
