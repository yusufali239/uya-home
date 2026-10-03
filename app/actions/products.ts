'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scheduleNotifications } from '@/lib/telegram/notify';
import type { ActionState } from '@/lib/types';
import { dbError, int, money, str } from './helpers';

/** Поля товара из формы + валидация */
function readProduct(formData: FormData) {
  const product = {
    name: str(formData, 'name'),
    sku: str(formData, 'sku'),
    color: str(formData, 'color'),
    dimensions: str(formData, 'dimensions'),
    price: money(formData, 'price'),
    cost_price: money(formData, 'cost_price'),
    min_quantity: int(formData, 'min_quantity'),
    brand_photo_url: str(formData, 'brand_photo_url'),
    sketchcut_file_url: str(formData, 'sketchcut_file_url'),
    instruction_url: str(formData, 'instruction_url'),
  };

  if (!product.name) return { error: 'Mahsulot nomini kiriting' } as const;
  if (!product.sku) return { error: 'Artikulni (SKU) kiriting' } as const;
  if (!Number.isFinite(product.price) || product.price < 0) return { error: 'Narx notoʻgʻri' } as const;
  if (!Number.isFinite(product.cost_price) || product.cost_price < 0) return { error: 'Tannarx notoʻgʻri' } as const;
  if (!Number.isInteger(product.min_quantity) || product.min_quantity < 0) {
    return { error: 'Minimal qoldiq — butun son ≥ 0' } as const;
  }
  return { product } as const;
}

/** + Новый товар */
export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = readProduct(formData);
  if ('error' in parsed) return { error: parsed.error };

  const quantity = int(formData, 'quantity');
  if (!Number.isInteger(quantity) || quantity < 0) return { error: 'Qoldiq — butun son ≥ 0' };

  const supabase = createClient();
  const { data, error } = await supabase.from('products').insert(parsed.product).select('id').single();
  if (error) return { error: dbError(error) };

  // Строка склада создаётся триггером; выставляем начальный остаток и место
  const location = str(formData, 'location');
  if (quantity > 0 || location) {
    const { error: invError } = await supabase.rpc('set_inventory', {
      p_product_id: data.id,
      p_quantity: quantity,
      p_location: location,
    });
    if (invError) return { error: dbError(invError) };
  }

  revalidatePath('/admin');
  redirect('/admin');
}

/** Редактирование товара и корректировка остатка */
export async function updateProduct(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = readProduct(formData);
  if ('error' in parsed) return { error: parsed.error };

  const quantity = int(formData, 'quantity');
  const originalQuantity = int(formData, 'original_quantity');
  const location = str(formData, 'location');
  const originalLocation = str(formData, 'original_location');
  if (!Number.isInteger(quantity) || quantity < 0) return { error: 'Qoldiq — butun son ≥ 0' };

  const supabase = createClient();
  const { error } = await supabase.from('products').update(parsed.product).eq('id', id);
  if (error) return { error: dbError(error) };

  if (quantity !== originalQuantity) {
    // Остаток меняем только если его правили в форме — иначе затёрли бы
    // списания по заказам, сделанные пока форма была открыта
    const { error: invError } = await supabase.rpc('set_inventory', {
      p_product_id: id,
      p_quantity: quantity,
      p_location: location,
    });
    if (invError) return { error: dbError(invError) };
  } else if (location !== originalLocation) {
    const { error: locError } = await supabase.from('inventory_finished').update({ location }).eq('product_id', id);
    if (locError) return { error: dbError(locError) };
  }

  scheduleNotifications();
  revalidatePath('/admin');
  revalidatePath(`/admin/products/${id}`);
  return { ok: true, message: 'Saqlandi' };
}
