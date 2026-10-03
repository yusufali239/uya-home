'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from '@/lib/types';
import { dbError, int, str } from './helpers';

/** Добавить обрезок вручную */
export async function addRemnant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const size = str(formData, 'size');
  const quantity = int(formData, 'quantity', 1);
  if (!size) return { error: 'Укажите размер, например 800x600' };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'Количество больше нуля' };

  const supabase = createClient();
  const { error } = await supabase.from('scrap_remnants').insert({ size, color: str(formData, 'color'), quantity });
  if (error) return { error: dbError(error) };

  revalidatePath('/admin/remnants');
  return { ok: true, message: 'Обрезок добавлен' };
}

/** Обрезок использован: уменьшаем количество или удаляем */
export async function consumeRemnant(id: string): Promise<void> {
  await requireStaff();
  const supabase = createClient();
  const { data } = await supabase.from('scrap_remnants').select('quantity').eq('id', id).single();
  if (!data) return;

  if (data.quantity > 1) {
    await supabase.from('scrap_remnants').update({ quantity: data.quantity - 1 }).eq('id', id);
  } else {
    await supabase.from('scrap_remnants').delete().eq('id', id);
  }
  revalidatePath('/admin/remnants');
}
