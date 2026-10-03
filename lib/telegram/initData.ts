import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

/** Данные Mini App действительны сутки — дальше Telegram выдаст новые */
const MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Проверка подписи initData из Telegram Mini App.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * secret = HMAC_SHA256("WebAppData", bot_token)
 * hash   = HMAC_SHA256(secret, отсортированные "ключ=значение" через \n, без hash)
 *
 * Без этой проверки любой мог бы прислать чужой telegram id и войти под ним.
 */
export function verifyInitData(initData: string, botToken: string): TelegramWebAppUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  const received = Buffer.from(hash, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TelegramWebAppUser | null;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}
