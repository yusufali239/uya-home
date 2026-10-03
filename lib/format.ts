import type { BatchStatus, FinanceKind, FinanceStatus, OrderSource, OrderStatus, UserRole } from '@/lib/types';

/** Подписи источников заказа */
export const SOURCE_LABELS: Record<OrderSource, string> = {
  lalafo: 'Lalafo',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  mesto: 'Mesto',
  call: 'Qoʻngʻiroq',
};

/** Подписи статусов заказа + цвет бейджа (классы Tailwind) */
export const ORDER_STATUS: Record<OrderStatus, { label: string; className: string }> = {
  new: { label: 'Yangi', className: 'bg-slate-100 text-slate-700' },
  confirmed: { label: 'Tasdiqlangan', className: 'bg-blue-100 text-blue-700' },
  ready_to_ship: { label: 'Joʻnatishga tayyor', className: 'bg-emerald-100 text-emerald-700' },
  shipped: { label: 'Joʻnatilgan', className: 'bg-gray-200 text-gray-600' },
  waiting_production: { label: 'Ishlab chiqarishni kutmoqda', className: 'bg-amber-100 text-amber-800' },
};

export const BATCH_STATUS: Record<BatchStatus, { label: string; className: string }> = {
  planned: { label: 'Rejalashtirilgan', className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Ishda', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Yakunlangan', className: 'bg-emerald-100 text-emerald-700' },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  director: 'Direktor',
  manager: 'Menejer',
  master: 'Usta',
};

export const FINANCE_KIND: Record<FinanceKind, { label: string; sign: string; className: string }> = {
  income: { label: 'Kirim', sign: '+', className: 'text-emerald-700' },
  expense: { label: 'Chiqim', sign: '−', className: 'text-red-600' },
  transfer: { label: 'Topshirish', sign: '→', className: 'text-blue-700' },
};

export const FINANCE_STATUS: Record<FinanceStatus, { label: string; className: string }> = {
  pending: { label: 'Tekshiruv kutmoqda', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Tasdiqlangan', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rad etilgan', className: 'bg-gray-200 text-gray-500 line-through' },
};

/** Частые статьи для подсказок */
export const FINANCE_CATEGORIES = {
  expense: ['Materiallar', 'Furnitura', 'Asbob-uskuna', 'Transport', 'Ijara', 'Ish haqi', 'Kommunal', 'Reklama', 'Boshqa'],
  income: ['Mijoz toʻlovi', 'Oldindan toʻlov', 'Yetkazib berish', 'Boshqa'],
  transfer: ['Kassaga topshirdim', 'Xarajatga berdim'],
} as const;

/** Количество без лишних нулей: 12.50 → «12,5» */
export function formatQty(value: number | string): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value));
}

/** Дата без времени: 2026-10-03 → «03.10.2026» */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** Склонение: plural(2, ['лист', 'листа', 'листов']) → 'листа' */
export function plural(n: number, forms: [string, string, string]): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** Деньги в сомах */
export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)} som`;
}

/** Дата и время по-русски (часовой пояс Бишкека) */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek',
  }).format(new Date(iso));
}

/**
 * PostgREST возвращает связь один-к-одному то объектом, то массивом —
 * приводим к одному объекту.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
