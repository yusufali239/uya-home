import { NextResponse, type NextRequest } from 'next/server';
import { flushNotifications } from '@/lib/telegram/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Страховка: досылает уведомления, которые не ушли сразу
 * (например, Telegram был недоступен). Вызывается Vercel Cron.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await flushNotifications();
  return NextResponse.json({ ok: true, ...result });
}
