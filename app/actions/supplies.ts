'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { flushNotifications } from '@/lib/telegram/notify';
import type { ActionState } from '@/lib/types';
import { dbError, str } from './helpers';

/** Число из формы с запятой или точкой; пусто → fallback */
function num(formData: FormData, key: string, fallback = 0): number {
  const raw = String(formData.get(key) ?? '').trim().replace(',', '.');
  return raw === '' ? fallback : Number(raw);
}

function refresh() {
  revalidatePath('/master/supplies');
  revalidatePath('/admin/supplies');
}

/** Новая позиция мелочей */
export async function createSupply(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const name = str(formData, 'name');
  const quantity = num(formData, 'quantity');
  const minQuantity = num(formData, 'min_quantity');
  if (!name) return { error: 'Укажите название' };
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(minQuantity) || minQuantity < 0) {
    return { error: 'Количество — число ≥ 0' };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc('create_supply', {
    p_name: name,
    p_unit: str(formData, 'unit') ?? 'шт',
    p_quantity: quantity,
    p_min_quantity: minQuantity,
    p_location: str(formData, 'location'),
  });
  if (error) return { error: dbError(error) };

  refresh();
  return { ok: true, message: `«${name}» добавлено` };
}

/** Приход/расход (delta) или пересчёт (set) */
export async function adjustSupply(
  supplyId: string,
  change: { delta?: number; set?: number; note?: string },
): Promise<ActionState> {
  await requireUser();
  if (change.delta !== undefined && !Number.isFinite(change.delta)) return { error: 'Неверное количество' };
  if (change.set !== undefined && (!Number.isFinite(change.set) || change.set < 0)) return { error: 'Неверное количество' };

  const supabase = createClient();
  const { error } = await supabase.rpc('adjust_supply', {
    p_supply_id: supplyId,
    p_delta: change.delta ?? null,
    p_set: change.set ?? null,
    p_note: change.note ?? null,
  });
  if (error) return { error: dbError(error) };

  await flushNotifications();
  refresh();
  return { ok: true };
}

/** Изменить карточку позиции */
export async function updateSupply(supplyId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const name = str(formData, 'name');
  const minQuantity = num(formData, 'min_quantity');
  if (!name) return { error: 'Укажите название' };
  if (!Number.isFinite(minQuantity) || minQuantity < 0) return { error: 'Минимум — число ≥ 0' };

  const supabase = createClient();
  const { error } = await supabase.rpc('update_supply', {
    p_supply_id: supplyId,
    p_name: name,
    p_unit: str(formData, 'unit') ?? 'шт',
    p_min_quantity: minQuantity,
    p_location: str(formData, 'location'),
  });
  if (error) return { error: dbError(error) };

  refresh();
  return { ok: true, message: 'Сохранено' };
}

/** Удалить позицию (директор/менеджер) */
export async function deleteSupply(supplyId: string): Promise<ActionState> {
  await requireStaff();
  const supabase = createClient();
  const { error } = await supabase.from('supplies').delete().eq('id', supplyId);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}
