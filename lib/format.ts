import type { BatchStatus, OrderSource, OrderStatus, UserRole } from '@/lib/types';

/** Подписи источников заказа */
export const SOURCE_LABELS: Record<OrderSource, string> = {
  lalafo: 'Lalafo',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  mesto: 'Mesto',
  call: 'Звонок',
};

/** Подписи статусов заказа + цвет бейджа (классы Tailwind) */
export const ORDER_STATUS: Record<OrderStatus, { label: string; className: string }> = {
  new: { label: 'Новый', className: 'bg-slate-100 text-slate-700' },
  confirmed: { label: 'Подтверждён', className: 'bg-blue-100 text-blue-700' },
  ready_to_ship: { label: 'К отгрузке', className: 'bg-emerald-100 text-emerald-700' },
  shipped: { label: 'Отгружен', className: 'bg-gray-200 text-gray-600' },
  waiting_production: { label: 'Ждёт производства', className: 'bg-amber-100 text-amber-800' },
};

export const BATCH_STATUS: Record<BatchStatus, { label: string; className: string }> = {
  planned: { label: 'Запланирована', className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'В работе', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Завершена', className: 'bg-emerald-100 text-emerald-700' },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  director: 'Директор',
  manager: 'Менеджер',
  master: 'Мастер',
};

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
  return `${new Intl.NumberFormat('ru-RU').format(n)} сом`;
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
