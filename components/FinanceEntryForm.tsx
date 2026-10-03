'use client';

import { useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { addFinanceEntry } from '@/app/actions/finance';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import { FINANCE_CATEGORIES, ROLE_LABELS } from '@/lib/format';
import type { ActionState, FinanceKind, Profile } from '@/lib/types';

type Person = Pick<Profile, 'id' | 'full_name' | 'role'>;

const KIND_BUTTONS: { kind: FinanceKind; label: string; active: string }[] = [
  { kind: 'expense', label: '− Chiqim', active: 'bg-red-600 text-white ring-red-600' },
  { kind: 'income', label: '+ Kirim', active: 'bg-emerald-600 text-white ring-emerald-600' },
  { kind: 'transfer', label: '→ Topshirdim', active: 'bg-blue-600 text-white ring-blue-600' },
];

interface Props {
  people: Person[];
  selfId: string;
  /** Директор/менеджер: можно выбрать, чьи деньги */
  isStaff: boolean;
}

/** Запись расхода / прихода / передачи денег */
export function FinanceEntryForm({ people, selfId, isStaff }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<FinanceKind>('expense');
  const [category, setCategory] = useState('');
  const [personId, setPersonId] = useState(selfId);

  const [state, action] = useFormState(async (prev: ActionState, data: FormData) => {
    const result = await addFinanceEntry(prev, data);
    if (result.ok) {
      formRef.current?.reset();
      setCategory('');
    }
    return result;
  }, {});

  // Кому можно передать: всем, кроме самого «плательщика»; мастеру — обычно директору/менеджеру
  const recipients = people
    .filter((p) => p.id !== personId)
    .sort((a, b) => Number(b.role !== 'master') - Number(a.role !== 'master'));
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bishkek' });

  return (
    <form ref={formRef} action={action} className="card space-y-4">
      <input type="hidden" name="kind" value={kind} />

      <div className="grid grid-cols-3 gap-2">
        {KIND_BUTTONS.map((b) => (
          <button
            key={b.kind}
            type="button"
            onClick={() => {
              setKind(b.kind);
              setCategory('');
            }}
            className={`rounded-xl px-2 py-3 font-semibold ring-1 ${kind === b.kind ? b.active : 'bg-white ring-gray-300'}`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {isStaff && (
        <div>
          <label className="label" htmlFor="person_id">
            {kind === 'income' ? 'Pulni kim oldi' : kind === 'expense' ? 'Kim toʻladi' : 'Kim topshirdi'}
          </label>
          <select id="person_id" name="person_id" className="input" value={personId} onChange={(e) => setPersonId(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({ROLE_LABELS[p.role]})
              </option>
            ))}
          </select>
        </div>
      )}

      {kind === 'transfer' && (
        <div>
          <label className="label" htmlFor="to_person_id">Kimga topshirildi</label>
          <select id="to_person_id" name="to_person_id" required className="input" defaultValue={recipients[0]?.id}>
            {recipients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({ROLE_LABELS[p.role]})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label" htmlFor="amount">Summa, som</label>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          required
          placeholder="0"
          className="input py-3 text-center text-3xl font-black"
        />
      </div>

      <div>
        <label className="label" htmlFor="category">{kind === 'transfer' ? 'Sabab' : 'Modda'}</label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {FINANCE_CATEGORIES[kind].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-sm ring-1 ${category === c ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-gray-300'}`}
            >
              {c}
            </button>
          ))}
        </div>
        <input id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="input" placeholder="yoki oʻzingiz yozing" />
      </div>

      <div>
        <label className="label" htmlFor="description">Aniq nima</label>
        <input
          id="description"
          name="description"
          className="input"
          placeholder={kind === 'expense' ? 'Ustaxona uchun parma va yelim oldim' : kind === 'income' ? 'UYA-012 buyurtma uchun naqd toʻlov' : ''}
        />
      </div>

      <div>
        <label className="label" htmlFor="entry_date">Sana</label>
        <input id="entry_date" name="entry_date" type="date" defaultValue={today} max={today} className="input" />
      </div>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-lg">Yozish</SubmitButton>
      {!isStaff && <p className="text-center text-xs text-gray-500">Yozuvni direktor koʻrib tasdiqlaydi</p>}
    </form>
  );
}
