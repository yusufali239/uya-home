'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { ActionState, UserRole } from '@/lib/types';
import { str } from './helpers';

const ROLES: UserRole[] = ['director', 'manager', 'master'];

/** Директор создаёт сотрудника (без регистрации и писем) */
export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(['director']);

  const email = str(formData, 'email');
  const password = str(formData, 'password');
  const fullName = str(formData, 'full_name');
  const role = str(formData, 'role') as UserRole | null;

  if (!email || !password || !fullName) return { error: 'Заполните имя, email и пароль' };
  if (password.length < 6) return { error: 'Пароль — минимум 6 символов' };
  if (!role || !ROLES.includes(role)) return { error: 'Выберите роль' };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { error: error.message };

  // Профиль создан триггером с ролью «мастер» — выставляем выбранную
  const { error: roleError } = await admin.from('profiles').update({ role, full_name: fullName }).eq('id', data.user.id);
  if (roleError) return { error: roleError.message };

  revalidatePath('/admin/users');
  return { ok: true, message: `Сотрудник ${fullName} создан. Логин: ${email}` };
}

/** Смена роли сотрудника */
export async function changeRole(userId: string, formData: FormData): Promise<void> {
  const me = await requireRole(['director']);
  const role = String(formData.get('role')) as UserRole;
  if (!ROLES.includes(role) || userId === me.id) return; // себя не понижаем

  const supabase = createClient();
  await supabase.from('profiles').update({ role }).eq('id', userId);
  revalidatePath('/admin/users');
}
