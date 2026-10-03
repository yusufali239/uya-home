import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, requireServerEnv } from '@/lib/env';

/**
 * Клиент с service_role — обходит RLS.
 * Только для сервера: Telegram-бот, очередь уведомлений, создание пользователей.
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL, requireServerEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
