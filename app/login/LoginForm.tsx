'use client';

import { useFormState } from 'react-dom';
import { signIn } from '@/app/actions/auth';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useFormState(signIn, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Пароль</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-lg" pendingText="Входим…">
        Войти
      </SubmitButton>
    </form>
  );
}
