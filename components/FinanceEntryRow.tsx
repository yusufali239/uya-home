'use client';

import { useState, useTransition } from 'react';
import { deleteFinanceEntry, reviewFinanceEntry } from '@/app/actions/finance';
import { FINANCE_KIND, FINANCE_STATUS, formatDate, formatMoney } from '@/lib/format';
import type { FinanceEntry } from '@/lib/types';

interface Props {
  entry: FinanceEntry;
  personName: string;
  toName?: string;
  /** Показывать кнопки подтверждения и удаления */
  canReview: boolean;
}

/** Строка журнала денег */
export function FinanceEntryRow({ entry, personName, toName, canReview }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const kind = FINANCE_KIND[entry.kind];
  const status = FINANCE_STATUS[entry.status];

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.error ?? '');
    });

  return (
    <li className={`px-4 py-3 ${entry.status === 'rejected' ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {personName}
            {entry.kind === 'transfer' && toName && <span className="text-blue-700"> → {toName}</span>}
          </div>
          <div className="text-sm text-gray-600">
            {[entry.category, entry.description].filter(Boolean).join(' — ') || kind.label}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {formatDate(entry.entry_date)}
            <span className={`badge ${status.className}`}>{status.label}</span>
          </div>
        </div>
        <div className={`whitespace-nowrap text-right text-lg font-bold ${kind.className}`}>
          {kind.sign} {formatMoney(entry.amount)}
        </div>
      </div>

      {canReview && (
        <div className="mt-2 flex flex-wrap gap-2">
          {entry.status === 'pending' && (
            <>
              <button className="btn-success px-3 py-1.5 text-sm" disabled={pending} onClick={() => run(() => reviewFinanceEntry(entry.id, true))}>
                ✓ Подтвердить
              </button>
              <button className="btn-secondary px-3 py-1.5 text-sm" disabled={pending} onClick={() => run(() => reviewFinanceEntry(entry.id, false))}>
                ✗ Отклонить
              </button>
            </>
          )}
          <button
            className="ml-auto text-xs text-gray-400 hover:text-red-600"
            disabled={pending}
            onClick={() => confirm('Удалить запись?') && run(() => deleteFinanceEntry(entry.id))}
          >
            удалить
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </li>
  );
}
