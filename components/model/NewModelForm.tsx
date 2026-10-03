'use client';

import { useFormState } from 'react-dom';
import { createModel } from '@/app/actions/models';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import { ModelFields } from './ModelFields';
import { VariantFields } from './VariantFields';

/** Новая модель + её первый цвет. Остальные цвета и детали — в карточке модели. */
export function NewModelForm() {
  const [state, formAction] = useFormState(createModel, {});
  return (
    <form action={formAction} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="font-semibold">Model</h2>
        <ModelFields />
      </section>
      <section className="card space-y-4">
        <h2 className="font-semibold">Birinchi rang</h2>
        <p className="text-sm text-gray-500">Boshqa ranglar va detallar roʻyxatini yaratilgandan keyin model kartasida qoʻshasiz.</p>
        <VariantFields idPrefix="first" />
      </section>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-lg sm:w-auto">Model yaratish</SubmitButton>
    </form>
  );
}
