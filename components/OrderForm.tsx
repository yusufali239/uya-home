'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { createOrder } from '@/app/actions/orders';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import { SOURCE_LABELS } from '@/lib/format';
import type { OrderSource } from '@/lib/types';

export interface OrderProductOption {
  id: string;
  name: string;
  sku: string;
  color: string | null;
  stock: number;
}

const SOURCES = Object.keys(SOURCE_LABELS) as OrderSource[];

/** Форма заказа: Откуда? → Что? → Клиент */
export function OrderForm({ products }: { products: OrderProductOption[] }) {
  const [state, action] = useFormState(createOrder, {});
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);

  const selected = products.find((p) => p.id === productId);
  const inStock = selected ? selected.stock >= quantity : null;

  return (
    <form action={action} className="space-y-5">
      <section className="card space-y-3">
        <h2 className="font-semibold">1. Откуда заказ?</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SOURCES.map((source) => (
            <label key={source} className="cursor-pointer">
              <input type="radio" name="source" value={source} required className="peer sr-only" />
              <span className="block rounded-xl px-3 py-3 text-center font-medium ring-1 ring-gray-300 peer-checked:bg-brand-600 peer-checked:text-white peer-checked:ring-brand-600 peer-focus-visible:ring-2">
                {SOURCE_LABELS[source]}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">2. Что заказали?</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div>
            <label className="label" htmlFor="product_id">Товар</label>
            <select
              id="product_id"
              name="product_id"
              required
              className="input"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">— выберите —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}{p.color ? `, ${p.color}` : ''}) — на складе {p.stock}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="quantity">Кол-во</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="input"
            />
          </div>
        </div>
        {selected && (
          <p
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
            }`}
          >
            {inStock
              ? `✅ Есть на складе (${selected.stock} шт.) — заказ сразу уйдёт мастеру на отправку`
              : `⏳ На складе ${selected.stock} шт. — заказ будет ждать производства`}
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">3. Клиент</h2>
        <div>
          <label className="label" htmlFor="client_name">ФИО</label>
          <input id="client_name" name="client_name" required autoComplete="off" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="client_phone">Телефон</label>
          <input id="client_phone" name="client_phone" type="tel" required placeholder="+996 ___ ___ ___" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="client_address">Адрес доставки</label>
          <textarea id="client_address" name="client_address" required rows={2} className="input" />
        </div>
      </section>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-lg" pendingText="Создаю заказ…">
        Создать заказ
      </SubmitButton>
    </form>
  );
}
