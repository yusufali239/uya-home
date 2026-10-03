'use client';

import { useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { adjustSupply, deleteSupply, updateSupply } from '@/app/actions/supplies';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import { formatQty } from '@/lib/format';
import type { Supply } from '@/lib/types';

type Mode = 'view' | 'take' | 'add' | 'count' | 'edit';

/** Карточка мелочи: крупные кнопки «Взял», «Пришло», «Пересчитал» */
export function SupplyCard({ supply, low, canDelete }: { supply: Supply; low: boolean; canDelete: boolean }) {
  const [mode, setMode] = useState<Mode>('view');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const [editState, editAction] = useFormState(updateSupply.bind(null, supply.id), {});

  function open(next: Mode) {
    setMode(next);
    setValue(next === 'count' ? String(Number(supply.quantity)) : '');
    setNote('');
    setError('');
  }

  function submit() {
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || (mode !== 'count' && n === 0)) {
      setError('Введите количество');
      return;
    }
    startTransition(async () => {
      const result = await adjustSupply(
        supply.id,
        mode === 'count' ? { set: n, note } : { delta: mode === 'take' ? -n : n, note },
      );
      if (result.error) setError(result.error);
      else setMode('view');
    });
  }

  return (
    <div className={`card space-y-3 ${low ? 'ring-2 ring-red-300' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold leading-tight">{supply.name}</div>
          <div className="text-xs text-gray-500">
            {supply.location && `📍 ${supply.location} · `}минимум {formatQty(supply.min_quantity)} {supply.unit}
          </div>
        </div>
        <div className={`text-right text-2xl font-black ${low ? 'text-red-600' : ''}`}>
          {formatQty(supply.quantity)}
          <span className="ml-1 text-sm font-medium text-gray-500">{supply.unit}</span>
        </div>
      </div>

      {mode === 'view' && (
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-secondary py-3" onClick={() => open('take')}>− Взял</button>
          <button className="btn-secondary py-3" onClick={() => open('add')}>+ Пришло</button>
          <button className="btn-secondary py-3" onClick={() => open('count')}>Пересчёт</button>
          <button className="col-span-3 text-sm text-gray-500 hover:underline" onClick={() => open('edit')}>
            Изменить карточку
          </button>
        </div>
      )}

      {(mode === 'take' || mode === 'add' || mode === 'count') && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {mode === 'take' ? 'Сколько взяли?' : mode === 'add' ? 'Сколько пришло?' : 'Сколько есть на самом деле?'}
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input flex-1 text-center text-2xl font-bold"
              placeholder="0"
            />
            <span className="self-center text-gray-500">{supply.unit}</span>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input text-sm"
            placeholder={mode === 'take' ? 'На что (необязательно): Партия №3' : 'Комментарий (необязательно)'}
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary py-3" onClick={() => setMode('view')} disabled={pending}>Отмена</button>
            <button className="btn-primary py-3" onClick={submit} disabled={pending}>
              {pending ? '…' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <form action={editAction} className="space-y-2">
          <input name="name" defaultValue={supply.name} required className="input" aria-label="Название" />
          <div className="grid grid-cols-2 gap-2">
            <input name="unit" defaultValue={supply.unit} className="input" aria-label="Единица" placeholder="шт" />
            <input name="min_quantity" defaultValue={String(Number(supply.min_quantity))} inputMode="decimal" className="input" aria-label="Минимум" />
          </div>
          <input name="location" defaultValue={supply.location ?? ''} className="input" placeholder="Где лежит" aria-label="Где лежит" />
          <FormMessage state={editState} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary" onClick={() => setMode('view')}>Закрыть</button>
            <SubmitButton>Сохранить</SubmitButton>
          </div>
          {canDelete && (
            <button
              type="button"
              className="w-full text-sm text-red-600 hover:underline"
              onClick={() => {
                if (!confirm(`Удалить «${supply.name}» вместе с журналом?`)) return;
                startTransition(async () => {
                  const result = await deleteSupply(supply.id);
                  if (result.error) setError(result.error);
                });
              }}
            >
              Удалить позицию
            </button>
          )}
        </form>
      )}
    </div>
  );
}
