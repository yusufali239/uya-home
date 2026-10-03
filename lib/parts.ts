import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ProductPart } from '@/lib/types';

export interface BatchPartLine {
  model: string;
  part: ProductPart;
  perItem: number;
  items: number;
  total: number;
}

export interface BatchPartsGroup {
  color: string;
  lines: BatchPartLine[];
  pieces: number;
  area: number; // м²
}

/**
 * Сводный список деталей партии: детали модели × количество изделий,
 * сгруппированные по цвету ЛДСП (каждый цвет режется из своих листов).
 */
export async function loadBatchParts(
  items: { quantity: number; product: { model_id: string; name: string; color: string | null } | null }[],
): Promise<{ groups: BatchPartsGroup[]; modelsWithoutParts: string[] }> {
  const modelIds = [...new Set(items.flatMap((i) => (i.product ? [i.product.model_id] : [])))];
  if (modelIds.length === 0) return { groups: [], modelsWithoutParts: [] };

  const supabase = createClient();
  const { data } = await supabase.from('product_parts').select('*').in('model_id', modelIds).order('sort');
  const parts = (data ?? []) as ProductPart[];

  const byModel = new Map<string, ProductPart[]>();
  for (const p of parts) byModel.set(p.model_id, [...(byModel.get(p.model_id) ?? []), p]);

  const groups = new Map<string, BatchPartsGroup>();
  const without = new Set<string>();
  for (const item of items) {
    if (!item.product) continue;
    const modelParts = byModel.get(item.product.model_id);
    if (!modelParts?.length) {
      without.add(item.product.name);
      continue;
    }
    const color = item.product.color?.trim() || '—';
    const group = groups.get(color) ?? { color, lines: [], pieces: 0, area: 0 };
    for (const part of modelParts) {
      const total = part.quantity * item.quantity;
      group.lines.push({ model: item.product.name, part, perItem: part.quantity, items: item.quantity, total });
      group.pieces += total;
      group.area += (part.length_mm * part.width_mm * total) / 1e6;
    }
    groups.set(color, group);
  }

  return { groups: [...groups.values()], modelsWithoutParts: [...without] };
}
