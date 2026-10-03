'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scheduleNotifications } from '@/lib/telegram/notify';
import type { ActionState } from '@/lib/types';
import { dbError, int, str } from './helpers';

interface BatchItemInput {
  product_id: string;
  quantity: number;
}

/** Создать партию раскроя → уведомление мастеру в Telegram */
export async function createBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const sheetCount = int(formData, 'ldsp_sheet_count');
  if (!Number.isInteger(sheetCount) || sheetCount <= 0) return { error: 'LDSP listlari sonini kiriting' };

  let items: BatchItemInput[];
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'));
  } catch {
    return { error: 'Mahsulotlar roʻyxatini oʻqib boʻlmadi' };
  }
  items = items.filter((i) => i.product_id && Number.isInteger(i.quantity) && i.quantity > 0);
  if (items.length === 0) return { error: 'Kamida bitta mahsulotni belgilang va sonini kiriting' };

  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_cut_batch', {
      p_sheet_count: sheetCount,
      p_items: items,
      p_sketchcut_url: str(formData, 'sketchcut_file_url'),
      p_notes: str(formData, 'notes'),
    })
    .single<{ id: string }>();

  if (error) return { error: dbError(error) };

  scheduleNotifications();
  revalidatePath('/batches');
  revalidatePath('/master');
  redirect(`/batches/${data.id}?created=1`);
}

/** Мастер: «Детали принял» */
export async function startBatch(batchId: string): Promise<ActionState> {
  await requireUser();
  const supabase = createClient();
  const { error } = await supabase.rpc('start_cut_batch', { p_batch_id: batchId });
  if (error) return { error: dbError(error) };

  revalidatePath('/master');
  revalidatePath(`/master/batch/${batchId}`);
  revalidatePath('/batches');
  return { ok: true };
}

export interface CompleteBatchInput {
  items: { item_id: string; quantity_produced: number }[];
  remnants: { size: string; color: string; quantity: number }[];
}

/**
 * Мастер: «Готов». Склад пополняется, партия закрывается,
 * ждущие заказы автоматически переходят в «К отгрузке».
 */
export async function completeBatch(batchId: string, input: CompleteBatchInput): Promise<ActionState> {
  await requireUser();

  if (input.items.some((i) => !Number.isInteger(i.quantity_produced) || i.quantity_produced < 0)) {
    return { error: 'Soni butun son ≥ 0 boʻlishi kerak' };
  }
  const remnants = input.remnants
    .map((r) => ({ size: r.size.trim(), color: r.color.trim(), quantity: Math.max(1, Math.trunc(r.quantity) || 1) }))
    .filter((r) => r.size !== '');

  const supabase = createClient();
  const { data, error } = await supabase.rpc('complete_cut_batch', {
    p_batch_id: batchId,
    p_items: input.items,
    p_remnants: remnants,
  });
  if (error) return { error: dbError(error) };

  scheduleNotifications();
  revalidatePath('/master');
  revalidatePath('/admin');
  revalidatePath('/batches');

  const result = data as { produced: number; fulfilled_orders: number };
  return {
    ok: true,
    message:
      `Omborga: +${result.produced} dona.` +
      (result.fulfilled_orders > 0 ? ` Joʻnatishga tayyor buyurtmalar: ${result.fulfilled_orders}.` : ''),
  };
}
