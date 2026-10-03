'use client';

import { useFormState } from 'react-dom';
import { addRemnant } from '@/app/actions/remnants';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

export function RemnantForm() {
  const [state, action] = useFormState(addRemnant, {});
  return (
    <form action={action} className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="size">Размер, мм</label>
          <input id="size" name="size" placeholder="800x600" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="color">Цвет</label>
          <input id="color" name="color" placeholder="Белый" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="quantity">Шт.</label>
          <input id="quantity" name="quantity" type="number" min={1} defaultValue={1} className="input" />
        </div>
        <SubmitButton>Добавить</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
