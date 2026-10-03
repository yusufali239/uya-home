import { signOut } from '@/app/actions/auth';
import { unlinkTelegram } from '@/app/actions/account';
import { PasswordForm } from '@/components/PasswordForm';
import { ROLE_LABELS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

/** Профиль сотрудника: данные, пароль, привязка Telegram */
export async function AccountPanel({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-4">
      <div className="card space-y-1">
        <div className="text-xl font-bold">{profile.full_name}</div>
        <div className="text-gray-600">{user?.email}</div>
        <div className="badge bg-brand-100 text-brand-900">{ROLE_LABELS[profile.role]}</div>
      </div>

      <PasswordForm />

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Telegram</h2>
        {profile.telegram_id ? (
          <>
            <p className="text-gray-700">
              ✅ Привязан. Приложение в Telegram открывается без пароля, уведомления приходят вам лично.
            </p>
            <form action={unlinkTelegram}>
              <button className="btn-secondary w-full">Отвязать Telegram</button>
            </form>
          </>
        ) : (
          <p className="text-gray-700">
            Не привязан. Откройте бота и нажмите кнопку <b>«UYA HOME»</b> внизу чата — после входа Telegram привяжется сам.
          </p>
        )}
      </div>

      <form action={signOut}>
        <button className="btn-secondary w-full text-red-600">Выйти из аккаунта</button>
      </form>
    </div>
  );
}
