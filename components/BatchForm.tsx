'use client';

import { useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { createBatch } from '@/app/actions/batches';
import { FileUpload } from '@/components/FileUpload';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

export interface BatchCandidate {
  id: string;
  name: string;
  sku: string;
  color: string | null;
  stock: number;
  min: number;
  waiting: number;
  /** Рекомендуемое количество: добрать до минимума + закрыть ждущие заказы */
  suggested: number;
  low: boolean;
}

/** Форма создания партии раскроя */
export function BatchForm({ candidates }: { candidates: BatchCandidate[] }) {
  const [state, action] = useFormState(createBatch, {});
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});

  const needed = candidates.filter((c) => c.low || c.waiting > 0);
  const others = candidates.filter((c) => !c.low && c.waiting === 0);
  const visible = showAll ? [...needed, ...others] : needed;

  const items = useMemo(
    () => Object.entries(selected).map(([product_id, quantity]) => ({ product_id, quantity })),
    [selected],
  );
  const total = items.reduce((sum, i) => sum + (i.quantity || 0), 0);

  function toggle(c: BatchCandidate, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[c.id] = c.suggested;
      else delete next[c.id];
      return next;
    });
  }

  function setQty(id: string, value: number) {
    setSelected((prev) => ({ ...prev, [id]: Math.max(1, value || 1) }));
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">1. Что режем?</h2>
          {needed.length > 0 && (
            <button
              type="button"
              className="ml-auto text-sm font-medium text-brand-600 hover:underline"
              onClick={() => setSelected(Object.fromEntries(needed.map((c) => [c.id, c.suggested])))}
            >
              Отметить все, что заканчивается
            </button>
          )}
        </div>

        {visible.length === 0 && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Всё в норме — ни один товар не ниже минимума.
          </p>
        )}

        <ul className="divide-y">
          {visible.map((c) => {
            const checked = c.id in selected;
            return (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-brand-600"
                  checked={checked}
                  onChange={(e) => toggle(c, e.target.checked)}
                  id={`c-${c.id}`}
                />
                <label htmlFor={`c-${c.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <div className="font-medium">
                    {c.name} <span className="text-xs text-gray-500">{c.sku}{c.color ? ` · ${c.color}` : ''}</span>
                  </div>
                  <div className="text-xs">
                    <span className={c.low ? 'font-semibold text-red-600' : 'text-gray-500'}>
                      на складе {c.stock} / мин. {c.min}
                    </span>
                    {c.waiting > 0 && <span className="ml-2 font-semibold text-amber-700">ждут заказы: {c.waiting}</span>}
                  </div>
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!checked}
                  value={checked ? selected[c.id] : c.suggested}
                  onChange={(e) => setQty(c.id, Number(e.target.value))}
                  className="input w-20 text-center disabled:bg-gray-50 disabled:text-gray-400"
                  aria-label={`Количество ${c.name}`}
                />
                <span className="text-sm text-gray-500">шт.</span>
              </li>
            );
          })}
        </ul>

        {others.length > 0 && (
          <button type="button" className="text-sm text-gray-500 hover:underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Скрыть остальные товары' : `Показать остальные товары (${others.length})`}
          </button>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">2. Материал и раскрой</h2>
        <div className="max-w-xs">
          <label className="label" htmlFor="ldsp_sheet_count">Листов ЛДСП</label>
          <input id="ldsp_sheet_count" name="ldsp_sheet_count" type="number" min={1} required className="input" />
        </div>
        <FileUpload
          name="sketchcut_file_url"
          label="PDF раскроя (SketchCut)"
          bucket="batches"
          folder="sketchcut"
          accept="application/pdf,image/*"
        />
        <div>
          <label className="label" htmlFor="notes">Комментарий мастеру</label>
          <textarea id="notes" name="notes" rows={2} className="input" placeholder="Например: кромка 2 мм только по лицевой стороне" />
        </div>
      </section>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-lg" disabled={items.length === 0} pendingText="Создаю партию…">
        Создать партию{items.length > 0 ? ` (${items.length} поз., ${total} шт.)` : ''}
      </SubmitButton>
    </form>
  );
}
