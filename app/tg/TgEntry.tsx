'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { tgEnter, tgLogin, type TgEnterResult } from '@/app/actions/telegram';
import { loadTelegramWebApp } from '@/lib/telegram/webapp';

type State =
  | { kind: 'loading' }
  | { kind: 'outside' }
  | { kind: 'login'; name: string; initData: string; error?: string }
  | { kind: 'linked' }
  | { kind: 'error'; message: string };

export function TgEntry({ next }: { next?: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [pending, startTransition] = useTransition();

  /** Полная перезагрузка: сервер увидит свежие cookies сессии */
  function go(result: Extract<TgEnterResult, { status: 'ok' }>) {
    const target = next ?? result.redirect;
    if (result.linked) {
      window.Telegram?.WebApp.HapticFeedback?.notificationOccurred('success');
      setState({ kind: 'linked' });
      setTimeout(() => window.location.replace(target), 900);
    } else {
      window.location.replace(target);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tg = await loadTelegramWebApp();
      if (!tg?.initData) {
        if (!cancelled) setState({ kind: 'outside' });
        return;
      }
      const result = await tgEnter(tg.initData);
      if (cancelled) return;
      if (result.status === 'ok') go(result);
      else if (result.status === 'need_login') setState({ kind: 'login', name: result.telegramName, initData: tg.initData });
      else setState({ kind: 'error', message: result.message });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  switch (state.kind) {
    case 'loading':
      return <p className="py-8 text-center text-gray-500">Входим…</p>;
    case 'linked':
      return <p className="py-8 text-center text-lg font-semibold text-emerald-700">✅ Telegram привязан. Дальше вход без пароля.</p>;
    case 'error':
      return <p className="rounded-xl bg-red-50 p-3 text-center text-red-700">{state.message}</p>;
    case 'outside':
      return (
        <div className="space-y-4 text-center">
          <p className="text-gray-600">Эта страница открывается из Telegram-бота кнопкой «UYA HOME».</p>
          <Link href="/login" className="btn-primary w-full py-3">Войти на сайте</Link>
        </div>
      );
    case 'login':
      return (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await tgLogin(state.initData, String(form.get('email') ?? ''), String(form.get('password') ?? ''));
              if (result.status === 'ok') go(result);
              else setState({ ...state, error: result.status === 'error' ? result.message : 'Не удалось войти' });
            });
          }}
        >
          <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
            {state.name ? `${state.name}, войдите` : 'Войдите'} один раз своим email и паролем — Telegram запомнится,
            и дальше приложение будет открываться сразу.
          </p>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Пароль</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.error}</p>}
          <button type="submit" className="btn-primary w-full py-3 text-lg" disabled={pending}>
            {pending ? 'Входим…' : 'Войти'}
          </button>
        </form>
      );
  }
}
