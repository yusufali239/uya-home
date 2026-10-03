import 'server-only';
import { Telegraf } from 'telegraf';
import { APP_URL, masterChatIds, requireServerEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

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
        '👋 Bu UYA HOME boti.',
        '',
        webApp
          ? '«UYA HOMEʼni ochish» tugmasini bosing — ish ekraningiz ochiladi. Birinchi marta email va parolingiz bilan kiring, keyin — parolsiz.'
          : '',
        '',
        'Bu yerga keladi: 📦 joʻnatiladigan buyurtmalar, 🪚 kesish partiyalari, ⚠️ ombor ogohlantirishlari, 💰 tasdiqlash uchun yozuvlar.',
        '',
        `Sizning chat_id: ${chatId}`,
      ]
        .filter((line, i, all) => line !== '' || all[i - 1] !== '')
        .join('\n'),
      webApp
        ? { reply_markup: { inline_keyboard: [[{ text: '📱 UYA HOMEʼni ochish', web_app: { url: `${APP_URL}/tg` } }]] } }
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
      await ctx.reply('Avval menyudagi tugma orqali UYA HOMEʼni oching va kiring — shunda bot sizni taniydi.');
      return;
    }
    await ctx.reply(await buildTasksText(), { link_preview_options: { is_disabled: true } });
  });

  bot.help((ctx) => ctx.reply('/start — ulanish\n/tasks — joriy vazifalar'));

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

  const lines: string[] = ['📋 Hozirgi vazifalar'];

  if (batches?.length) {
    lines.push('', '🪚 Partiyalar:');
    for (const b of batches) {
      const state = b.status === 'in_progress' ? 'ishda' : 'yangi';
      lines.push(
        `• №${b.batch_number} partiya — ${b.ldsp_sheet_count} list (${state})`,
      );
    }
  }

  if (orders?.length) {
    lines.push('', '📦 Joʻnatish uchun:');
    for (const o of orders) {
      const product = Array.isArray(o.products) ? o.products[0] : o.products;
      lines.push(`• №${o.order_number}: ${product?.name ?? '?'} × ${o.quantity} — ${o.client_name}`);
    }
  }

  if (lines.length === 1) lines.push('', 'Vazifalar yoʻq 🎉');
  if (APP_URL) lines.push('', `${APP_URL}/master`);
  return lines.join('\n');
}

/** Кнопка «UYA HOME» слева от поля ввода — открывает Mini App */
export async function setupMenuButton(appUrl: string) {
  await getBot().telegram.setChatMenuButton({
    menuButton: { type: 'web_app', text: 'UYA HOME', web_app: { url: `${appUrl}/tg` } },
  });
}
