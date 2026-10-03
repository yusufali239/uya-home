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
  model_id: string;
  name: string;
  sku: string;
  color: string | null;
  stock: number;
}

const SOURCES = Object.keys(SOURCE_LABELS) as OrderSource[];

/** Форма заказа: Откуда? → Что? → Клиент */
export function OrderForm({ products }: { products: OrderProductOption[] }) {
  const [state, action] = useFormState(createOrder, {});
  const [modelId, setModelId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Модели с их цветами (порядок — как пришли с сервера)
  const models = new Map<string, { name: string; colors: OrderProductOption[] }>();
  for (const p of products) {
    const m = models.get(p.model_id) ?? { name: p.name, colors: [] };
    m.colors.push(p);
    models.set(p.model_id, m);
  }
  const colors = models.get(modelId)?.colors ?? [];

  function chooseModel(id: string) {
    setModelId(id);
    const list = models.get(id)?.colors ?? [];
    // Один цвет — выбираем сразу
    setProductId(list.length === 1 ? list[0].id : '');
  }

  const selected = products.find((p) => p.id === productId);
  const inStock = selected ? selected.stock >= quantity : null;

  return (
    <form action={action} className="space-y-5">
      <section className="card space-y-3">
        <h2 className="font-semibold">1. Buyurtma qayerdan?</h2>
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
        <h2 className="font-semibold">2. Nima buyurtma qilindi?</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div>
            <label className="label" htmlFor="model_id">Mahsulot</label>
            <select
              id="model_id"
              required
              className="input"
              value={modelId}
              onChange={(e) => chooseModel(e.target.value)}
            >
              <option value="">— tanlang —</option>
              {[...models.entries()].map(([id, m]) => (
                <option key={id} value={id}>
                  {m.name} — omborda {m.colors.reduce((s, c) => s + c.stock, 0)}
                  {m.colors.length > 1 ? ` (${m.colors.length} rang)` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="quantity">Soni</label>
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
        {colors.length > 0 && (
          <div>
            <span className="label">Rangi</span>
            <input type="hidden" name="product_id" value={productId} />
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setProductId(c.id)}
                  className={`rounded-xl px-3 py-2 text-left text-sm ring-1 ${
                    productId === c.id ? 'bg-brand-600 text-white ring-brand-600' : 'ring-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-semibold">{c.color || '—'}</span>
                  <span className={`block text-xs ${productId === c.id ? 'text-white/80' : 'text-gray-500'}`}>
                    {c.sku} · omborda {c.stock}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {selected && (
          <p
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
            }`}
          >
            {inStock
              ? `✅ Omborda bor (${selected.stock} dona) — buyurtma darhol ustaga joʻnatishga ketadi`
              : `⏳ Omborda ${selected.stock} dona — buyurtma ishlab chiqarishni kutadi`}
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">3. Mijoz</h2>
        <div>
          <label className="label" htmlFor="client_name">F.I.Sh.</label>
          <input id="client_name" name="client_name" required autoComplete="off" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="client_phone">Telefon</label>
          <input id="client_phone" name="client_phone" type="tel" required placeholder="+996 ___ ___ ___" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="client_address">Yetkazib berish manzili</label>
          <textarea id="client_address" name="client_address" required rows={2} className="input" />
        </div>
      </section>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-lg" pendingText="Buyurtma yaratilmoqda…">
        Buyurtma yaratish
      </SubmitButton>
    </form>
  );
}
