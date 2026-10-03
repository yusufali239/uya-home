'use client';

import { useRef } from 'react';
import { useFormState } from 'react-dom';
import { changePassword } from '@/app/actions/account';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useFormState(async (prev: Parameters<typeof changePassword>[0], data: FormData) => {
    const result = await changePassword(prev, data);
    if (result.ok) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={action} className="card space-y-3">
      <h2 className="text-lg font-semibold">Parolni oʻzgartirish</h2>
      <div>
        <label className="label" htmlFor="current_password">Joriy parol</label>
        <input id="current_password" name="current_password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="new_password">Yangi parol (kamida 8 ta belgi)</label>
        <input id="new_password" name="new_password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="repeat_password">Yangi parolni takrorlang</label>
        <input id="repeat_password" name="repeat_password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3">Parolni oʻzgartirish</SubmitButton>
    </form>
  );
}
