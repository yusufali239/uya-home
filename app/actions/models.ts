'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scheduleNotifications } from '@/lib/telegram/notify';
import type { ActionState } from '@/lib/types';
import { dbError, int, money, str } from './helpers';

/** Общие поля модели из формы */
function readModel(formData: FormData) {
  const model = {
    name: str(formData, 'name'),
    dimensions: str(formData, 'dimensions'),
    price: money(formData, 'price'),
    cost_price: money(formData, 'cost_price'),
    description: str(formData, 'description'),
    photo_url: str(formData, 'photo_url'),
    sketchcut_file_url: str(formData, 'sketchcut_file_url'),
    instruction_url: str(formData, 'instruction_url'),
  };
  if (!model.name) return { error: 'Model nomini kiriting' } as const;
  if (!Number.isFinite(model.price) || model.price < 0) return { error: 'Narx notoʻgʻri' } as const;
  if (!Number.isFinite(model.cost_price) || model.cost_price < 0) return { error: 'Tannarx notoʻgʻri' } as const;
  return { model } as const;
}

/** Поля цвета (варианта) из формы */
function readVariant(formData: FormData) {
  const variant = {
    color: str(formData, 'color'),
    sku: str(formData, 'sku'),
    min_quantity: int(formData, 'min_quantity'),
    brand_photo_url: str(formData, 'brand_photo_url'),
  };
  const quantity = int(formData, 'quantity');
  const location = str(formData, 'location');
  if (!variant.color) return { error: 'Rangni kiriting' } as const;
  if (!variant.sku) return { error: 'Artikulni (SKU) kiriting' } as const;
  if (!Number.isInteger(variant.min_quantity) || variant.min_quantity < 0) {
    return { error: 'Minimal qoldiq — butun son ≥ 0' } as const;
  }
  if (!Number.isInteger(quantity) || quantity < 0) return { error: 'Qoldiq — butun son ≥ 0' } as const;
  return { variant, quantity, location } as const;
}

function variantError(error: { code?: string; message: string }): string {
  if (error.code === '23505' && error.message.includes('products_model_color_uq')) {
    return 'Bu rang modelda allaqachon bor';
  }
  return dbError(error);
}

function revalidateModel(modelId: string) {
  revalidatePath('/admin');
  revalidatePath(`/admin/models/${modelId}`);
}

/** + Новая модель сразу с первым цветом */
export async function createModel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsedModel = readModel(formData);
  if ('error' in parsedModel) return { error: parsedModel.error };
  const parsedVariant = readVariant(formData);
  if ('error' in parsedVariant) return { error: parsedVariant.error };

  const supabase = createClient();
  const { data: model, error } = await supabase.from('product_models').insert(parsedModel.model).select('id').single();
  if (error) return { error: dbError(error) };

  // Название, размеры, цену и файлы цвет получает от модели (триггер в БД)
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({ ...parsedVariant.variant, model_id: model.id })
    .select('id')
    .single();
  if (productError) {
    await supabase.from('product_models').delete().eq('id', model.id);
    return { error: variantError(productError) };
  }

  if (parsedVariant.quantity > 0 || parsedVariant.location) {
    const { error: invError } = await supabase.rpc('set_inventory', {
      p_product_id: product.id,
      p_quantity: parsedVariant.quantity,
      p_location: parsedVariant.location,
    });
    if (invError) return { error: dbError(invError) };
  }

  revalidatePath('/admin');
  redirect(`/admin/models/${model.id}`);
}

/** Сохранить общие поля модели (копируются во все её цвета) */
export async function updateModel(modelId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = readModel(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createClient();
  const { error } = await supabase.from('product_models').update(parsed.model).eq('id', modelId);
  if (error) return { error: dbError(error) };

  revalidateModel(modelId);
  return { ok: true, message: 'Saqlandi' };
}

/** + Новый цвет в модели */
export async function addVariant(modelId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = readVariant(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .insert({ ...parsed.variant, model_id: modelId })
    .select('id')
    .single();
  if (error) return { error: variantError(error) };

  if (parsed.quantity > 0 || parsed.location) {
    const { error: invError } = await supabase.rpc('set_inventory', {
      p_product_id: data.id,
      p_quantity: parsed.quantity,
      p_location: parsed.location,
    });
    if (invError) return { error: dbError(invError) };
  }

  revalidateModel(modelId);
  return { ok: true, message: 'Rang qoʻshildi' };
}

/** Изменить цвет: артикул, минимум, фото, остаток и место */
export async function updateVariant(
  modelId: string,
  productId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();
  const parsed = readVariant(formData);
  if ('error' in parsed) return { error: parsed.error };

  const originalQuantity = int(formData, 'original_quantity');
  const originalLocation = str(formData, 'original_location');

  const supabase = createClient();
  const { error } = await supabase.from('products').update(parsed.variant).eq('id', productId);
  if (error) return { error: variantError(error) };

  if (parsed.quantity !== originalQuantity) {
    // Остаток меняем только если его правили в форме — иначе затёрли бы
    // списания по заказам, сделанные пока форма была открыта
    const { error: invError } = await supabase.rpc('set_inventory', {
      p_product_id: productId,
      p_quantity: parsed.quantity,
      p_location: parsed.location,
    });
    if (invError) return { error: dbError(invError) };
  } else if (parsed.location !== originalLocation) {
    const { error: locError } = await supabase
      .from('inventory_finished')
      .update({ location: parsed.location })
      .eq('product_id', productId);
    if (locError) return { error: dbError(locError) };
  }

  scheduleNotifications();
  revalidateModel(modelId);
  return { ok: true, message: 'Saqlandi' };
}

/** Удалить цвет (если по нему не было заказов и партий). Последний цвет удаляет и модель. */
export async function deleteVariant(modelId: string, productId: string): Promise<ActionState> {
  await requireStaff();
  const supabase = createClient();

  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) {
    if (error.code === '23503') return { error: 'Bu rang boʻyicha buyurtma yoki partiya bor — oʻchirib boʻlmaydi' };
    return { error: dbError(error) };
  }

  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('model_id', modelId);
  if (!count) {
    await supabase.from('product_models').delete().eq('id', modelId);
    revalidatePath('/admin');
    redirect('/admin');
  }

  revalidateModel(modelId);
  return { ok: true, message: 'Rang oʻchirildi' };
}

/** Сохранить список деталей модели целиком */
export async function saveParts(modelId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  let parts: unknown;
  try {
    parts = JSON.parse(String(formData.get('parts') ?? '[]'));
  } catch {
    return { error: 'Detallar roʻyxati notoʻgʻri' };
  }
  if (!Array.isArray(parts)) return { error: 'Detallar roʻyxati notoʻgʻri' };

  const supabase = createClient();
  const { data, error } = await supabase.rpc('save_model_parts', { p_model_id: modelId, p_parts: parts });
  if (error) return { error: dbError(error) };

  revalidateModel(modelId);
  return { ok: true, message: `Saqlandi: ${data} ta detal` };
}
