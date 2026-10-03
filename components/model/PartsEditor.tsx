'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { saveParts } from '@/app/actions/models';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import type { ProductPart } from '@/lib/types';

interface Row {
  key: string;
  name: string;
  length_mm: string;
  width_mm: string;
  thickness_mm: string;
  quantity: string;
  edge: string;
  notes: string;
}

let seq = 0;
const newKey = () => `r${++seq}`;
const emptyRow = (): Row => ({
  key: newKey(),
  name: '',
  length_mm: '',
  width_mm: '',
  thickness_mm: '16',
  quantity: '1',
  edge: '',
  notes: '',
});

const toRow = (p: ProductPart): Row => ({
  key: p.id,
  name: p.name,
  length_mm: String(p.length_mm),
  width_mm: String(p.width_mm),
  thickness_mm: String(Number(p.thickness_mm)),
  quantity: String(p.quantity),
  edge: p.edge ?? '',
  notes: p.notes ?? '',
});

/** Площадь деталей одного изделия, м² */
function totalArea(rows: Row[]): number {
  return rows.reduce((sum, r) => {
    const a = (Number(r.length_mm) * Number(r.width_mm) * (Number(r.quantity) || 0)) / 1e6;
    return sum + (Number.isFinite(a) ? a : 0);
  }, 0);
}

/** Блок «Detallar»: какие детали и каких размеров идут на одно изделие */
export function PartsEditor({ modelId, parts }: { modelId: string; parts: ProductPart[] }) {
  const [rows, setRows] = useState<Row[]>(() => (parts.length ? parts.map(toRow) : [emptyRow()]));
  const [state, formAction] = useFormState(saveParts.bind(null, modelId), {});

  const update = (key: string, field: keyof Row, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const duplicate = (key: string) =>
    setRows((rs) => rs.flatMap((r) => (r.key === key ? [r, { ...r, key: newKey() }] : [r])));
  const move = (index: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = index + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[index], copy[j]] = [copy[j], copy[index]];
      return copy;
    });

  const filled = rows.filter((r) => r.name.trim());
  const pieces = filled.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const payload = JSON.stringify(filled.map(({ key: _key, ...r }) => r));

  const cell = 'input px-2 py-1.5 text-sm';

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="parts" value={payload} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-8 px-1 py-2">№</th>
              <th className="px-1 py-2">Detal nomi</th>
              <th className="w-24 px-1 py-2">Uzunligi, mm</th>
              <th className="w-24 px-1 py-2">Eni, mm</th>
              <th className="w-20 px-1 py-2">Qalinligi</th>
              <th className="w-20 px-1 py-2">Soni</th>
              <th className="px-1 py-2">Kromka</th>
              <th className="px-1 py-2">Izoh</th>
              <th className="w-28 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className="align-top">
                <td className="px-1 py-1 pt-3 text-gray-400">{i + 1}</td>
                <td className="px-1 py-1">
                  <input
                    aria-label="Detal nomi"
                    value={r.name}
                    onChange={(e) => update(r.key, 'name', e.target.value)}
                    placeholder="Yon devor"
                    className={cell}
                  />
                </td>
                {(['length_mm', 'width_mm', 'thickness_mm', 'quantity'] as const).map((f) => (
                  <td key={f} className="px-1 py-1">
                    <input
                      aria-label={f}
                      value={r[f]}
                      onChange={(e) => update(r.key, f, e.target.value.replace(',', '.'))}
                      inputMode={f === 'thickness_mm' ? 'decimal' : 'numeric'}
                      required={!!r.name.trim()}
                      className={cell}
                    />
                  </td>
                ))}
                <td className="px-1 py-1">
                  <input
                    aria-label="Kromka"
                    value={r.edge}
                    onChange={(e) => update(r.key, 'edge', e.target.value)}
                    placeholder="2 uzun tomon"
                    className={cell}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    aria-label="Izoh"
                    value={r.notes}
                    onChange={(e) => update(r.key, 'notes', e.target.value)}
                    className={cell}
                  />
                </td>
                <td className="whitespace-nowrap px-1 py-1 pt-2 text-gray-400">
                  <button type="button" title="Yuqoriga" onClick={() => move(i, -1)} className="px-1 hover:text-gray-700">↑</button>
                  <button type="button" title="Pastga" onClick={() => move(i, 1)} className="px-1 hover:text-gray-700">↓</button>
                  <button type="button" title="Nusxa" onClick={() => duplicate(r.key)} className="px-1 hover:text-gray-700">⧉</button>
                  <button type="button" title="Oʻchirish" onClick={() => remove(r.key)} className="px-1 hover:text-red-600">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
        <button type="button" className="btn-secondary" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          + Detal qoʻshish
        </button>
        <span>
          Jami: <b>{filled.length}</b> xil, <b>{pieces}</b> dona detal, <b>{totalArea(filled).toFixed(2)}</b> m² (1 dona mahsulot uchun)
        </span>
      </div>

      <FormMessage state={state} />
      <SubmitButton>Detallarni saqlash</SubmitButton>
    </form>
  );
}
