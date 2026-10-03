'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { shipOrder } from '@/app/actions/orders';

/** Кнопка «Отгружен» с подтверждением */
interface Props {
  orderId: string;
  className?: string;
  label?: string;
  /** Куда перейти после успешной отгрузки */
  redirectTo?: string;
}

export function ShipButton({ orderId, className = 'btn-success', label = 'Отгружен', redirectTo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (!confirm('Подтвердить отгрузку заказа?')) return;
          startTransition(async () => {
            const result = await shipOrder(orderId);
            setError(result.error ?? '');
            if (!result.error && redirectTo) router.push(redirectTo);
          });
        }}
      >
        {pending ? 'Сохраняю…' : label}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </>
  );
}
