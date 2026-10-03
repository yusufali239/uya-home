/**
 * Доступ к переменным окружения с понятными ошибками.
 * Публичные (NEXT_PUBLIC_*) читаются напрямую, чтобы Next.js встроил их в клиентский бандл.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

/** Обязательная серверная переменная: бросает ошибку, если не задана */
export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} muhit oʻzgaruvchisi berilmagan. .env.example ga qarang`);
  }
  return value;
}

/** Список chat_id мастера (через запятую) */
export function masterChatIds(): string[] {
  return (process.env.TELEGRAM_MASTER_CHAT_ID ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
