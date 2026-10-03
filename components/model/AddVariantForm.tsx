'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { addVariant } from '@/app/actions/models';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import { VariantFields } from './VariantFields';

/** + Новый цвет в модели */
export function AddVariantForm({ modelId }: { modelId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(addVariant.bind(null, modelId), {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <div className="space-y-2">
        {state.ok && <FormMessage state={state} />}
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>+ Rang qoʻshish</button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-2xl border-2 border-dashed border-gray-300 p-4">
      <h3 className="font-semibold">Yangi rang</h3>
      <VariantFields idPrefix="new" />
      <FormMessage state={state.ok ? undefined : state} />
      <div className="flex gap-2">
        <SubmitButton>Qoʻshish</SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Bekor qilish</button>
      </div>
    </form>
  );
}
