import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/types';

/**
 * Кто вошёл — по JWT из cookie.
 * getClaims() проверяет подпись ES256 локально (ключи JWKS кешируются),
 * без сетевого запроса к Supabase Auth на каждую страницу.
 * cache() — один раз за запрос, даже если спрашивают layout, страница и компоненты.
 */
export const getSessionClaims = cache(async (): Promise<{ id: string; email: string | null } | null> => {
  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
});

/** Текущий пользователь и его профиль (или null, если не вошёл) */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const session = await getSessionClaims();
  if (!session) return null;

  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').eq('id', session.id).single();
  return (data as Profile | null) ?? null;
});

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
