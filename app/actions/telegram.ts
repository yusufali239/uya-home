'use server';

import { requireServerEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { verifyInitData } from '@/lib/telegram/initData';
import type { UserRole } from '@/lib/types';

export type TgEnterResult =
  | { status: 'ok'; redirect: string; linked?: boolean }
  | { status: 'need_login'; telegramName: string }
  | { status: 'error'; message: string };

const homeFor = (role: UserRole) => (role === 'master' ? '/master' : '/admin');

/**
 * Вход из Telegram Mini App.
 *  1. Проверяем подпись initData — это точно этот пользователь Telegram.
 *  2. Telegram уже привязан к сотруднику → создаём сессию без пароля.
 *  3. Не привязан, но сотрудник только что вошёл по паролю → привязываем.
 *  4. Иначе просим один раз войти по email и паролю.
 */
export async function tgEnter(initData: string): Promise<TgEnterResult> {
  const tgUser = verifyInitData(initData, requireServerEnv('TELEGRAM_BOT_TOKEN'));
  if (!tgUser) return { status: 'error', message: 'Telegram maʼlumotlarini tekshirib boʻlmadi. Ilovani yopib, qayta oching.' };

  const admin = createAdminClient();
  const supabase = createClient();

  const { data: linked } = await admin
    .from('profiles')
    .select('id, role')
    .eq('telegram_id', tgUser.id)
    .maybeSingle();

  const {
    data: { user: current },
  } = await supabase.auth.getUser();

  // Уже вошёл именно этим сотрудником — просто открываем его экран
  if (linked && current?.id === linked.id) {
    return { status: 'ok', redirect: homeFor(linked.role) };
  }

  if (linked) {
    // Сессия без пароля: одноразовый токен magic link, сразу подтверждаем на сервере
    const { data: authUser, error: userError } = await admin.auth.admin.getUserById(linked.id);
    if (userError || !authUser.user.email) return { status: 'error', message: 'Xodim topilmadi' };

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email,
    });
    if (linkError) return { status: 'error', message: linkError.message };

    const { error: otpError } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties.hashed_token,
    });
    if (otpError) return { status: 'error', message: otpError.message };

    return { status: 'ok', redirect: homeFor(linked.role) };
  }

  if (current) return linkTelegram(current.id, tgUser.id);

  return {
    status: 'need_login',
    telegramName: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || '',
  };
}

/** Привязать Telegram к сотруднику (у другого сотрудника этот Telegram отвязывается) */
async function linkTelegram(profileId: string, telegramId: number): Promise<TgEnterResult> {
  const admin = createAdminClient();
  await admin.from('profiles').update({ telegram_id: null }).eq('telegram_id', telegramId);
  const { data: profile, error } = await admin
    .from('profiles')
    .update({ telegram_id: telegramId })
    .eq('id', profileId)
    .select('role')
    .single();
  if (error) return { status: 'error', message: error.message };
  return { status: 'ok', redirect: homeFor(profile.role), linked: true };
}

/**
 * Первый вход из Mini App: email + пароль, и сразу привязка Telegram —
 * одним действием, без перехода на другую страницу.
 */
export async function tgLogin(initData: string, email: string, password: string): Promise<TgEnterResult> {
  const tgUser = verifyInitData(initData, requireServerEnv('TELEGRAM_BOT_TOKEN'));
  if (!tgUser) return { status: 'error', message: 'Telegram maʼlumotlarini tekshirib boʻlmadi. Ilovani yopib, qayta oching.' };
  if (!email.trim() || !password) return { status: 'error', message: 'Email va parolni kiriting' };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return { status: 'error', message: 'Email yoki parol notoʻgʻri' };

  return linkTelegram(data.user.id, tgUser.id);
}
