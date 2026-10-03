'use client';

import { useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { deleteVariant, updateVariant } from '@/app/actions/models';
import { FormMessage } from '@/components/FormMessage';
import { StockStatus } from '@/components/StockStatus';
import { SubmitButton } from '@/components/SubmitButton';
import type { ActionState, ProductWithStock } from '@/lib/types';
import { VariantFields } from './VariantFields';

/** Один цвет модели: редактирование и удаление */
export function VariantCard({ variant, waiting }: { variant: ProductWithStock; waiting: number }) {
  const [state, formAction] = useFormState(updateVariant.bind(null, variant.model_id, variant.id), {});
  const [deleteState, setDeleteState] = useState<ActionState>();
  const [deleting, startDelete] = useTransition();
  const qty = variant.inventory_finished?.quantity ?? 0;

  function handleDelete() {
    if (!confirm(`«${variant.color}» rangini oʻchirasizmi?`)) return;
    startDelete(async () => setDeleteState(await deleteVariant(variant.model_id, variant.id)));
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-base font-semibold">{variant.color || '—'}</span>
        <span className="text-sm text-gray-500">{variant.sku}</span>
        <StockStatus quantity={qty} min={variant.min_quantity} />
        {waiting > 0 && <span className="text-xs font-medium text-amber-700">kutmoqda: {waiting}</span>}
      </div>
      <VariantFields variant={variant} idPrefix={variant.id} />
      <FormMessage state={deleteState ?? state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton>Saqlash</SubmitButton>
        <button type="button" onClick={handleDelete} disabled={deleting} className="btn-secondary text-red-600">
          {deleting ? 'Oʻchirilmoqda…' : 'Rangni oʻchirish'}
        </button>
      </div>
    </form>
  );
}
