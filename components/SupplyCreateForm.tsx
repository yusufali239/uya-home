'use client';

import { useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { createSupply } from '@/app/actions/supplies';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import type { ActionState } from '@/lib/types';

const UNITS = ['шт', 'уп', 'кг', 'м', 'л', 'рулон'];

/** Добавление новой позиции мелочей (свёрнуто, чтобы не мешать) */
export function SupplyCreateForm() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useFormState(async (prev: ActionState, data: FormData) => {
    const result = await createSupply(prev, data);
    if (result.ok) formRef.current?.reset();
    return result;
  }, {});

  if (!open) {
    return (
      <button className="btn-primary w-full py-3 text-lg" onClick={() => setOpen(true)}>
        + Добавить позицию
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="card space-y-3">
      <div className="flex items-center">
        <h2 className="text-lg font-semibold">Новая позиция</h2>
        <button type="button" className="ml-auto p-1 text-2xl leading-none text-gray-400" onClick={() => setOpen(false)} aria-label="Закрыть">
          ×
        </button>
      </div>
      <div>
        <label className="label" htmlFor="supply-name">Название</label>
        <input id="supply-name" name="name" required placeholder="Евровинт 7×50" className="input" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label" htmlFor="supply-qty">Есть сейчас</label>
          <input id="supply-qty" name="quantity" inputMode="decimal" defaultValue="0" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="supply-unit">Ед.</label>
          <select id="supply-unit" name="unit" className="input">
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="supply-min">Минимум</label>
          <input id="supply-min" name="min_quantity" inputMode="decimal" defaultValue="0" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="supply-location">Где лежит</label>
        <input id="supply-location" name="location" placeholder="Ящик 3, полка Б" className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3">Добавить</SubmitButton>
    </form>
  );
}
