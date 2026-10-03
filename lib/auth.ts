import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/types';

/** Текущий пользователь и его профиль (или null, если не вошёл) */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return (data as Profile | null) ?? null;
}

/** Требует входа; иначе — на страницу логина */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

/** Требует одну из ролей; мастера без прав отправляем на его экран */
export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireUser();
  if (!roles.includes(profile.role)) redirect('/master');
  return profile;
}

/** Директор или менеджер */
export function requireStaff(): Promise<Profile> {
  return requireRole(['director', 'manager']);
}

export function isStaff(profile: Profile | null): boolean {
  return profile?.role === 'director' || profile?.role === 'manager';
}
