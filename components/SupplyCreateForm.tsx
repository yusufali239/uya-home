'use client';

import { useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { createSupply } from '@/app/actions/supplies';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import type { ActionState } from '@/lib/types';

const UNITS = ['dona', 'quti', 'kg', 'm', 'l', 'rulon'];

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
        + Pozitsiya qoʻshish
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="card space-y-3">
      <div className="flex items-center">
        <h2 className="text-lg font-semibold">Yangi pozitsiya</h2>
        <button type="button" className="ml-auto p-1 text-2xl leading-none text-gray-400" onClick={() => setOpen(false)} aria-label="Yopish">
          ×
        </button>
      </div>
      <div>
        <label className="label" htmlFor="supply-name">Nomi</label>
        <input id="supply-name" name="name" required placeholder="Yevrovint 7×50" className="input" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label" htmlFor="supply-qty">Hozir bor</label>
          <input id="supply-qty" name="quantity" inputMode="decimal" defaultValue="0" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="supply-unit">Birlik</label>
          <select id="supply-unit" name="unit" className="input">
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="supply-min">Minimum</label>
          <input id="supply-min" name="min_quantity" inputMode="decimal" defaultValue="0" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="supply-location">Qayerda turadi</label>
        <input id="supply-location" name="location" placeholder="3-quti, B javon" className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3">Qoʻshish</SubmitButton>
    </form>
  );
}
