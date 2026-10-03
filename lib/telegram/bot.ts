import 'server-only';
import { Telegraf } from 'telegraf';
import { APP_URL, masterChatIds, requireServerEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { plural } from '@/lib/format';

let bot: Telegraf | null = null;

/**
 * Единственный экземпляр бота на процесс.
 * На Vercel бот работает через вебхук (/api/telegram/webhook), а не polling.
 */
export function getBot(): Telegraf {
  if (bot) return bot;

  bot = new Telegraf(requireServerEnv('TELEGRAM_BOT_TOKEN'));

  // /start — приветствие и chat_id, который нужно вписать в TELEGRAM_MASTER_CHAT_ID
  bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    const registered = masterChatIds().includes(String(chatId));
    await ctx.reply(
      [
        '👋 Это бот UYA HOME.',
        '',
        'Сюда приходят:',
        '📦 новые заказы на отправку',
        '⚠️ сигналы, что товар заканчивается',
        '🪚 новые партии раскроя',
        '',
        `Ваш chat_id: ${chatId}`,
        registered
          ? '✅ Этот чат уже подключён к уведомлениям.'
          : 'Чтобы получать уведомления, впишите этот chat_id в переменную TELEGRAM_MASTER_CHAT_ID на Vercel.',
        APP_URL ? `\nЭкран мастера: ${APP_URL}/master` : '',
        '\nКоманда /tasks — текущие задачи.',
      ].join('\n'),
    );
  });

  // /tasks — что сейчас в работе (только для подключённых чатов)
  bot.command('tasks', async (ctx) => {
    if (!masterChatIds().includes(String(ctx.chat.id))) {
      await ctx.reply('Этот чат не подключён. Отправьте /start, чтобы узнать chat_id.');
      return;
    }
    await ctx.reply(await buildTasksText(), { link_preview_options: { is_disabled: true } });
  });

  bot.help((ctx) => ctx.reply('/start — подключение\n/tasks — текущие задачи'));

  return bot;
}

/** Текст со списком активных задач мастера */
async function buildTasksText(): Promise<string> {
  const supabase = createAdminClient();

  const [{ data: batches }, { data: orders }] = await Promise.all([
    supabase
      .from('cut_batches')
      .select('batch_number, status, ldsp_sheet_count')
      .in('status', ['planned', 'in_progress'])
      .order('batch_number'),
    supabase
      .from('orders')
      .select('order_number, quantity, client_name, products(name)')
      .eq('status', 'ready_to_ship')
      .order('created_at'),
  ]);

  const lines: string[] = ['📋 Задачи на сейчас'];

  if (batches?.length) {
    lines.push('', '🪚 Партии:');
    for (const b of batches) {
      const state = b.status === 'in_progress' ? 'в работе' : 'новая';
      lines.push(
        `• Партия №${b.batch_number} — ${b.ldsp_sheet_count} ${plural(b.ldsp_sheet_count, ['лист', 'листа', 'листов'])} (${state})`,
      );
    }
  }

  if (orders?.length) {
    lines.push('', '📦 К отправке:');
    for (const o of orders) {
      const product = Array.isArray(o.products) ? o.products[0] : o.products;
      lines.push(`• №${o.order_number}: ${product?.name ?? '?'} × ${o.quantity} — ${o.client_name}`);
    }
  }

  if (lines.length === 1) lines.push('', 'Задач нет 🎉');
  if (APP_URL) lines.push('', `${APP_URL}/master`);
  return lines.join('\n');
}
