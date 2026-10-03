import { NextResponse, type NextRequest } from 'next/server';
import { APP_URL, requireServerEnv } from '@/lib/env';
import { getBot } from '@/lib/telegram/bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Одноразовая настройка бота после деплоя:
 *   GET /api/telegram/setup?secret=<TELEGRAM_WEBHOOK_SECRET>
 * Регистрирует вебхук и список команд.
 */
export async function GET(request: NextRequest) {
  const secret = requireServerEnv('TELEGRAM_WEBHOOK_SECRET');
  if (request.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'Неверный secret' }, { status: 401 });
  }

  const baseUrl = APP_URL || request.nextUrl.origin;
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const telegram = getBot().telegram;

  await telegram.setWebhook(webhookUrl, {
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  await telegram.setMyCommands([
    { command: 'start', description: 'Подключение и chat_id' },
    { command: 'tasks', description: 'Текущие задачи мастера' },
  ]);

  const info = await telegram.getWebhookInfo();
  return NextResponse.json({ ok: true, webhook: info.url, pending: info.pending_update_count });
}
