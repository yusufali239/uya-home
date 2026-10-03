import 'server-only';

/** Строка из формы (пустая → null) */
export function str(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? '').trim();
  return value === '' ? null : value;
}

/** Целое неотрицательное число из формы (пустое → fallback) */
export function int(formData: FormData, key: string, fallback = 0): number {
  const raw = String(formData.get(key) ?? '').trim();
  if (raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

/** Число (цена) из формы, допускает запятую */
export function money(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (raw === '') return 0;
  return Number(raw);
}

/** Человекочитаемая ошибка Postgres/PostgREST */
export function dbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Bunday artikul (SKU) allaqachon mavjud';
  if (error.code === '42501') return 'Huquq yetarli emas';
  return error.message;
}
