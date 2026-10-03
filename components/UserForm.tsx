'use client';

import { useFormState } from 'react-dom';
import { createUser } from '@/app/actions/users';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

export function UserForm() {
  const [state, action] = useFormState(createUser, {});
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Xodim qoʻshish</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="full_name">Ism</label>
          <input id="full_name" name="full_name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="role">Lavozim</label>
          <select id="role" name="role" defaultValue="master" className="input">
            <option value="master">Usta</option>
            <option value="manager">Menejer</option>
            <option value="director">Direktor</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="email">Email (login)</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Parol</label>
          <input id="password" name="password" type="text" minLength={6} required className="input" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Yaratish</SubmitButton>
    </form>
  );
}
