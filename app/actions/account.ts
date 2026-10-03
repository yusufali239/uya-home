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

  if (next.length < 8) return { error: 'Новый пароль — минимум 8 символов' };
  if (next !== repeat) return { error: 'Пароли не совпадают' };
  if (next === current) return { error: 'Новый пароль совпадает со старым' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || user.id !== profile.id) return { error: 'Нужно войти заново' };

  // Проверяем текущий пароль, чтобы чужой человек с открытым телефоном не сменил его
  const { error: checkError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (checkError) return { error: 'Текущий пароль неверный' };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  return { ok: true, message: 'Пароль изменён' };
}

/** Отвязать Telegram: вход в Mini App снова потребует пароль */
export async function unlinkTelegram(): Promise<void> {
  const profile = await requireUser();
  await createAdminClient().from('profiles').update({ telegram_id: null }).eq('id', profile.id);
  revalidatePath('/admin/account');
  revalidatePath('/master/account');
}
