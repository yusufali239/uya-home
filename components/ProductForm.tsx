'use client';

import { useFormState } from 'react-dom';
import { FileUpload } from '@/components/FileUpload';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import type { ActionState, ProductWithStock } from '@/lib/types';

interface Props {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  product?: ProductWithStock;
}

/** Форма товара: создание и редактирование */
export function ProductForm({ action, product }: Props) {
  const [state, formAction] = useFormState(action, {});
  const quantity = product?.inventory_finished?.quantity ?? 0;
  const location = product?.inventory_finished?.location ?? '';

  return (
    <form action={formAction} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="font-semibold">Основное</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Название *</label>
            <input id="name" name="name" required placeholder="Стол-5" defaultValue={product?.name} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="sku">Артикул (SKU) *</label>
            <input id="sku" name="sku" required placeholder="ST-005" defaultValue={product?.sku} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="color">Цвет</label>
            <input id="color" name="color" placeholder="Дуб сонома" defaultValue={product?.color ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="dimensions">Размеры</label>
            <input id="dimensions" name="dimensions" placeholder="1200×600×750" defaultValue={product?.dimensions ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="price">Цена продажи, сом</label>
            <input id="price" name="price" inputMode="decimal" defaultValue={product?.price ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cost_price">Себестоимость, сом</label>
            <input id="cost_price" name="cost_price" inputMode="decimal" defaultValue={product?.cost_price ?? ''} className="input" />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Склад</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="min_quantity">Минимальный остаток *</label>
            <input
              id="min_quantity"
              name="min_quantity"
              type="number"
              min={0}
              required
              defaultValue={product?.min_quantity ?? 5}
              className="input"
            />
            <p className="mt-1 text-xs text-gray-500">Ниже — сигнал в Telegram и товар попадает в партию</p>
          </div>
          <div>
            <label className="label" htmlFor="quantity">{product ? 'Остаток на складе' : 'Начальный остаток'}</label>
            <input id="quantity" name="quantity" type="number" min={0} defaultValue={quantity} className="input" />
            <input type="hidden" name="original_quantity" value={quantity} />
          </div>
          <div>
            <label className="label" htmlFor="location">Место хранения</label>
            <input id="location" name="location" placeholder="Стеллаж А1" defaultValue={location} className="input" />
            <input type="hidden" name="original_location" value={location} />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Файлы</h2>
        <FileUpload
          name="brand_photo_url"
          label="Фото товара (для бейджика)"
          bucket="products"
          folder="photos"
          accept="image/*"
          defaultUrl={product?.brand_photo_url}
        />
        <FileUpload
          name="sketchcut_file_url"
          label="Карта раскроя SketchCut (PDF)"
          bucket="products"
          folder="sketchcut"
          accept="application/pdf"
          defaultUrl={product?.sketchcut_file_url}
        />
        <FileUpload
          name="instruction_url"
          label="Инструкция по сборке"
          bucket="products"
          folder="instructions"
          accept="application/pdf,image/*"
          defaultUrl={product?.instruction_url}
        />
      </section>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-lg sm:w-auto">
        {product ? 'Сохранить' : 'Создать товар'}
      </SubmitButton>
    </form>
  );
}
