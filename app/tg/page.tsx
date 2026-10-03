import type { Metadata } from 'next';
import { TgEntry } from './TgEntry';

export const metadata: Metadata = { title: 'Вход через Telegram' };

/**
 * Точка входа Telegram Mini App (кнопка «UYA HOME» в боте).
 * Каждый сотрудник попадает на свой экран: директор/менеджер — /admin, мастер — /master.
 */
export default function TelegramEntryPage({ searchParams }: { searchParams: { next?: string } }) {
  // Только внутренние пути (защита от open redirect)
  const next = searchParams.next?.startsWith('/') && !searchParams.next.startsWith('//') ? searchParams.next : undefined;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="text-3xl font-black tracking-tight text-brand-700">UYA HOME</div>
        </div>
        <TgEntry next={next} />
      </div>
    </main>
  );
}
