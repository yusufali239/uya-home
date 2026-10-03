'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from '@/lib/types';

/** Смена своего пароля */
export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const current = String(formData.get('current_password') ?? '');
  const next = String(formData.get('new_password') ?? '');
  const repeat = String(formData.get('repeat_password') ?? '');

  if (next.length < 8) return { error: 'Yangi parol — kamida 8 ta belgi' };
  if (next !== repeat) return { error: 'Parollar mos kelmadi' };
  if (next === current) return { error: 'Yangi parol eskisi bilan bir xil' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || user.id !== profile.id) return { error: 'Qaytadan kiring' };

  // Проверяем текущий пароль, чтобы чужой человек с открытым телефоном не сменил его
  const { error: checkError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (checkError) return { error: 'Joriy parol notoʻgʻri' };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  return { ok: true, message: 'Parol oʻzgartirildi' };
}

/** Отвязать Telegram: вход в Mini App снова потребует пароль */
export async function unlinkTelegram(): Promise<void> {
  const profile = await requireUser();
  await createAdminClient().from('profiles').update({ telegram_id: null }).eq('id', profile.id);
  revalidatePath('/admin/account');
  revalidatePath('/master/account');
}
