import { NextResponse, type NextRequest } from 'next/server';
import { getBot } from '@/lib/telegram/bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Вебхук Telegram. Telegram присылает заголовок с секретом,
 * указанным при setWebhook — чужие запросы отбрасываем.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = await request.json();
    await getBot().handleUpdate(update);
  } catch (err) {
    // Отвечаем 200, иначе Telegram будет бесконечно повторять «битый» апдейт
    console.error('[telegram] Ошибка обработки апдейта:', err);
  }

  return NextResponse.json({ ok: true });
}
