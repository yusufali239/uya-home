'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scheduleNotifications } from '@/lib/telegram/notify';
import type { ActionState, OrderSource } from '@/lib/types';
import { dbError, int, str } from './helpers';

const SOURCES: OrderSource[] = ['lalafo', 'whatsapp', 'instagram', 'mesto', 'call'];

/**
 * + Новый заказ.
 * Решение «есть на складе / ждём производства» и списание остатка
 * делает функция БД create_order в одной транзакции.
 */
export async function createOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const source = str(formData, 'source') as OrderSource | null;
  const productId = str(formData, 'product_id');
  const quantity = int(formData, 'quantity', 1);
  const clientName = str(formData, 'client_name');
  const clientPhone = str(formData, 'client_phone');
  const clientAddress = str(formData, 'client_address');

  if (!source || !SOURCES.includes(source)) return { error: 'Buyurtma qayerdan kelganini tanlang' };
  if (!productId) return { error: 'Mahsulotni tanlang' };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'Soni — noldan katta butun son' };
  if (!clientName || !clientPhone || !clientAddress) return { error: 'F.I.Sh., telefon va manzilni toʻldiring' };

  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_order', {
      p_source: source,
      p_product_id: productId,
      p_quantity: quantity,
      p_client_name: clientName,
      p_client_phone: clientPhone,
      p_client_address: clientAddress,
    })
    .single<{ id: string; order_number: string; status: string }>();

  if (error) return { error: dbError(error) };

  // Триггеры уже положили уведомления в очередь — отправляем в Telegram
  scheduleNotifications();

  revalidatePath('/admin');
  revalidatePath('/admin/orders');
  revalidatePath('/master');
  redirect(`/admin/orders?created=${data.order_number}&status=${data.status}`);
}

/** Отметить заказ отгруженным (мастер или менеджер) */
export async function shipOrder(orderId: string): Promise<ActionState> {
  await requireUser();
  const supabase = createClient();
  const { error } = await supabase.rpc('ship_order', { p_order_id: orderId });
  if (error) return { error: dbError(error) };

  revalidatePath('/master');
  revalidatePath(`/master/order/${orderId}`);
  revalidatePath('/admin/orders');
  return { ok: true };
}
