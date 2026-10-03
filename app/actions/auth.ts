'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from '@/lib/types';

/** Вход по email и паролю */
export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');

  if (!email || !password) return { error: 'Email va parolni kiriting' };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Email yoki parol notoʻgʻri' };

  // Разрешаем только внутренние пути (защита от open redirect)
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

/** Выход */
export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
