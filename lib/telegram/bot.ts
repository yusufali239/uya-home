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

  // /start — приветствие, chat_id и кнопка Mini App
  bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    const webApp = APP_URL.startsWith('https://');
    await ctx.reply(
      [
        '👋 Это бот UYA HOME.',
        '',
        webApp
          ? 'Нажмите «Открыть UYA HOME» — откроется ваш рабочий экран. В первый раз войдите своим email и паролем, дальше — без пароля.'
          : '',
        '',
        'Сюда приходят: 📦 заказы на отправку, 🪚 партии раскроя, ⚠️ сигналы склада, 💰 записи для подтверждения.',
        '',
        `Ваш chat_id: ${chatId}`,
      ]
        .filter((line, i, all) => line !== '' || all[i - 1] !== '')
        .join('\n'),
      webApp
        ? { reply_markup: { inline_keyboard: [[{ text: '📱 Открыть UYA HOME', web_app: { url: `${APP_URL}/tg` } }]] } }
        : undefined,
    );
  });

  // /tasks — что сейчас в работе (только для подключённых чатов)
  bot.command('tasks', async (ctx) => {
    const { data: linked } = await createAdminClient()
      .from('profiles')
      .select('id')
      .eq('telegram_id', ctx.chat.id)
      .maybeSingle();
    if (!linked && !masterChatIds().includes(String(ctx.chat.id))) {
      await ctx.reply('Сначала откройте UYA HOME кнопкой в меню и войдите — тогда бот вас узнает.');
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

/** Кнопка «UYA HOME» слева от поля ввода — открывает Mini App */
export async function setupMenuButton(appUrl: string) {
  await getBot().telegram.setChatMenuButton({
    menuButton: { type: 'web_app', text: 'UYA HOME', web_app: { url: `${appUrl}/tg` } },
  });
}
