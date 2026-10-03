import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Supabase-клиент для серверных компонентов и server actions.
 * Работает от имени вошедшего пользователя — RLS применяется.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Вызов из серверного компонента: cookies там только для чтения.
          // Сессию обновляет middleware, так что это безопасно игнорировать.
        }
      },
    },
  });
}
