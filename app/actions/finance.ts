'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scheduleNotifications } from '@/lib/telegram/notify';
import type { ActionState, FinanceKind } from '@/lib/types';
import { dbError, str } from './helpers';

const KINDS: FinanceKind[] = ['income', 'expense', 'transfer'];

function refresh() {
  revalidatePath('/admin/finance');
  revalidatePath('/master/finance');
}

/** Новая запись: приход, расход или передача денег */
export async function addFinanceEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();

  const kind = str(formData, 'kind') as FinanceKind | null;
  const amount = Number(String(formData.get('amount') ?? '').replace(/\s/g, '').replace(',', '.'));
  const toPerson = str(formData, 'to_person_id');

  if (!kind || !KINDS.includes(kind)) return { error: 'Tanlang: chiqim, kirim yoki topshirish' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Summani kiriting' };
  if (kind === 'transfer' && !toPerson) return { error: 'Pul kimga berildi?' };

  const supabase = createClient();
  const { error } = await supabase.rpc('add_finance_entry', {
    p_kind: kind,
    p_amount: amount,
    p_category: str(formData, 'category'),
    p_description: str(formData, 'description'),
    p_person_id: str(formData, 'person_id'), // пусто → сам сотрудник
    p_to_person_id: kind === 'transfer' ? toPerson : null,
    p_entry_date: str(formData, 'entry_date'),
  });
  if (error) return { error: dbError(error) };

  scheduleNotifications();
  refresh();
  return { ok: true, message: 'Yozildi' };
}

/** Подтвердить или отклонить запись мастера */
export async function reviewFinanceEntry(entryId: string, approve: boolean): Promise<ActionState> {
  await requireStaff();
  const supabase = createClient();
  const { error } = await supabase.rpc('review_finance_entry', { p_entry_id: entryId, p_approve: approve });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

/** Удалить ошибочную запись (директор/менеджер) */
export async function deleteFinanceEntry(entryId: string): Promise<ActionState> {
  await requireStaff();
  const supabase = createClient();
  const { error } = await supabase.from('finance_entries').delete().eq('id', entryId);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}
