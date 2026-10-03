'use client';

/** Минимальный набор API Telegram Mini App, который мы используем */
export interface TelegramWebApp {
  initData: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: { notificationOccurred(type: 'success' | 'error' | 'warning'): void };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
const FLAG = 'uya-in-telegram';

/** Открыто ли приложение внутри Telegram (первая загрузка несёт #tgWebAppData) */
export function isInsideTelegram(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.hash.includes('tgWebAppData')) {
    try {
      sessionStorage.setItem(FLAG, '1');
    } catch {}
    return true;
  }
  try {
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

let loading: Promise<TelegramWebApp | null> | null = null;

/** Подгружает SDK Telegram только внутри Telegram — обычным браузерам он не нужен */
export function loadTelegramWebApp(): Promise<TelegramWebApp | null> {
  if (typeof window === 'undefined' || !isInsideTelegram()) return Promise.resolve(null);
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);

  loading ??= new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = () => resolve(window.Telegram?.WebApp ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return loading;
}
