'use client';

import { useFormState } from 'react-dom';
import { updateModel } from '@/app/actions/models';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import type { ProductModel } from '@/lib/types';
import { ModelFields } from './ModelFields';

/** Блок «Asosiy»: общие поля модели */
export function ModelForm({ model }: { model: ProductModel }) {
  const [state, formAction] = useFormState(updateModel.bind(null, model.id), {});
  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="text-lg font-semibold">Asosiy</h2>
      <ModelFields model={model} />
      <FormMessage state={state} />
      <SubmitButton>Saqlash</SubmitButton>
    </form>
  );
}
