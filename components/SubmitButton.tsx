'use client';

import { useFormStatus } from 'react-dom';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pendingText?: string;
}

/** Кнопка отправки формы, блокируется пока server action выполняется */
export function SubmitButton({ children, pendingText = 'Saqlanmoqda…', className = 'btn-primary', disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} {...rest}>
      {pending ? pendingText : children}
    </button>
  );
}
