'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { completeBatch, startBatch } from '@/app/actions/batches';
import type { BatchStatus } from '@/lib/types';

interface Item {
  id: string;
  name: string;
  planned: number;
  color: string;
}

interface Remnant {
  size: string;
  color: string;
  quantity: number;
}

/** Кнопки мастера: «Детали принял» → «Готов» (с модалкой факта и обрезков) */
export function BatchActions({ batchId, status, items }: { batchId: string; status: BatchStatus; items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [open, setOpen] = useState(false);
  const [produced, setProduced] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.id, i.planned])),
  );
  const [remnants, setRemnants] = useState<Remnant[]>([]);

  if (done || status === 'completed') {
    return (
      <div className="card space-y-4 p-6 text-center">
        <div className="text-5xl">✅</div>
        <div className="text-xl font-semibold">Партия завершена</div>
        {done && <p className="text-lg text-gray-600">{done}</p>}
        <button className="btn-primary btn-xl" onClick={() => router.push('/master')}>К задачам</button>
      </div>
    );
  }

  function onStart() {
    setError('');
    startTransition(async () => {
      const result = await startBatch(batchId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function onComplete() {
    setError('');
    startTransition(async () => {
      const result = await completeBatch(batchId, {
        items: items.map((i) => ({ item_id: i.id, quantity_produced: produced[i.id] ?? 0 })),
        remnants,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        setDone(result.message ?? '');
      }
    });
  }

  const setQty = (id: string, value: number) => setProduced((p) => ({ ...p, [id]: Math.max(0, value) }));
  const updateRemnant = (index: number, patch: Partial<Remnant>) =>
    setRemnants((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <>
      {status === 'planned' && (
        <button className="btn-primary btn-xl" disabled={pending} onClick={onStart}>
          {pending ? 'Сохраняю…' : '✋ Детали принял'}
        </button>
      )}
      {status === 'in_progress' && (
        <button className="btn-success btn-xl" onClick={() => setOpen(true)}>
          ✅ Готов
        </button>
      )}
      {error && !open && <p className="text-center text-lg font-medium text-red-600">{error}</p>}

      {/* Модалка «Готов»: что получилось + обрезки */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="mb-4 flex items-center">
              <h2 className="text-2xl font-bold">Что получилось?</h2>
              <button className="ml-auto p-2 text-3xl leading-none text-gray-400" onClick={() => setOpen(false)} aria-label="Закрыть">
                ×
              </button>
            </div>

            <div className="space-y-3">
              {items.map((i) => (
                <div key={i.id} className="rounded-2xl bg-gray-50 p-3">
                  <div className="text-lg font-semibold">{i.name}</div>
                  <div className="text-sm text-gray-500">план: {i.planned} шт.</div>
                  <div className="mt-2 flex items-center gap-3">
                    <button type="button" className="btn-secondary h-14 w-14 text-3xl" onClick={() => setQty(i.id, (produced[i.id] ?? 0) - 1)}>
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={produced[i.id] ?? 0}
                      onChange={(e) => setQty(i.id, Number(e.target.value) || 0)}
                      className="input h-14 flex-1 text-center text-2xl font-bold"
                    />
                    <button type="button" className="btn-secondary h-14 w-14 text-3xl" onClick={() => setQty(i.id, (produced[i.id] ?? 0) + 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="mb-2 mt-6 text-xl font-bold">Обрезки</h3>
            <div className="space-y-2">
              {remnants.map((r, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_4rem_2.5rem] gap-2">
                  <input
                    placeholder="800x600"
                    value={r.size}
                    onChange={(e) => updateRemnant(index, { size: e.target.value })}
                    className="input text-lg"
                    inputMode="text"
                  />
                  <input
                    placeholder="Цвет"
                    value={r.color}
                    onChange={(e) => updateRemnant(index, { color: e.target.value })}
                    className="input text-lg"
                  />
                  <input
                    type="number"
                    min={1}
                    value={r.quantity}
                    onChange={(e) => updateRemnant(index, { quantity: Number(e.target.value) || 1 })}
                    className="input text-center text-lg"
                  />
                  <button
                    type="button"
                    className="text-2xl text-gray-400"
                    onClick={() => setRemnants((list) => list.filter((_, i) => i !== index))}
                    aria-label="Удалить обрезок"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary w-full py-3 text-lg"
                onClick={() => setRemnants((list) => [...list, { size: '', color: items[0]?.color ?? '', quantity: 1 }])}
              >
                + Добавить обрезок
              </button>
            </div>

            {error && <p className="mt-4 text-center text-lg font-medium text-red-600">{error}</p>}

            <button className="btn-success btn-xl mt-6" disabled={pending} onClick={onComplete}>
              {pending ? 'Сохраняю…' : 'Сохранить и закрыть партию'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
