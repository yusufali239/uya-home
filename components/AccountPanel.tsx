import { signOut } from '@/app/actions/auth';
import { unlinkTelegram } from '@/app/actions/account';
import { PasswordForm } from '@/components/PasswordForm';
import { getSessionClaims } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/format';
import type { Profile } from '@/lib/types';

/** Профиль сотрудника: данные, пароль, привязка Telegram */
export async function AccountPanel({ profile }: { profile: Profile }) {
  const session = await getSessionClaims();

  return (
    <div className="space-y-4">
      <div className="card space-y-1">
        <div className="text-xl font-bold">{profile.full_name}</div>
        <div className="text-gray-600">{session?.email}</div>
        <div className="badge bg-brand-100 text-brand-900">{ROLE_LABELS[profile.role]}</div>
      </div>

      <PasswordForm />

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Telegram</h2>
        {profile.telegram_id ? (
          <>
            <p className="text-gray-700">
              ✅ Bogʻlangan. Telegramʼdagi ilova parolsiz ochiladi, xabarlar sizga shaxsan keladi.
            </p>
            <form action={unlinkTelegram}>
              <button className="btn-secondary w-full">Telegramni uzish</button>
            </form>
          </>
        ) : (
          <p className="text-gray-700">
            Bogʻlanmagan. Botni oching va chat pastidagi <b>«UYA HOME»</b> tugmasini bosing — kirgandan keyin Telegram oʻzi bogʻlanadi.
          </p>
        )}
      </div>

      <form action={signOut}>
        <button className="btn-secondary w-full text-red-600">Akkauntdan chiqish</button>
      </form>
    </div>
  );
}
