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
        <h2 className="font-semibold">Asosiy</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Nomi *</label>
            <input id="name" name="name" required placeholder="Stol-5" defaultValue={product?.name} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="sku">Artikul (SKU) *</label>
            <input id="sku" name="sku" required placeholder="ST-005" defaultValue={product?.sku} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="color">Rangi</label>
            <input id="color" name="color" placeholder="Dub sonoma" defaultValue={product?.color ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="dimensions">Oʻlchamlari</label>
            <input id="dimensions" name="dimensions" placeholder="1200×600×750" defaultValue={product?.dimensions ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="price">Sotish narxi, som</label>
            <input id="price" name="price" inputMode="decimal" defaultValue={product?.price ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cost_price">Tannarxi, som</label>
            <input id="cost_price" name="cost_price" inputMode="decimal" defaultValue={product?.cost_price ?? ''} className="input" />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Ombor</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="min_quantity">Minimal qoldiq *</label>
            <input
              id="min_quantity"
              name="min_quantity"
              type="number"
              min={0}
              required
              defaultValue={product?.min_quantity ?? 5}
              className="input"
            />
            <p className="mt-1 text-xs text-gray-500">Bundan kam boʻlsa — Telegramʼga xabar keladi va mahsulot partiyaga tushadi</p>
          </div>
          <div>
            <label className="label" htmlFor="quantity">{product ? 'Ombordagi qoldiq' : 'Boshlangʻich qoldiq'}</label>
            <input id="quantity" name="quantity" type="number" min={0} defaultValue={quantity} className="input" />
            <input type="hidden" name="original_quantity" value={quantity} />
          </div>
          <div>
            <label className="label" htmlFor="location">Saqlash joyi</label>
            <input id="location" name="location" placeholder="A1 javon" defaultValue={location} className="input" />
            <input type="hidden" name="original_location" value={location} />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Fayllar</h2>
        <FileUpload
          name="brand_photo_url"
          label="Mahsulot rasmi (yorliq uchun)"
          bucket="products"
          folder="photos"
          accept="image/*"
          defaultUrl={product?.brand_photo_url}
        />
        <FileUpload
          name="sketchcut_file_url"
          label="SketchCut kesish chizmasi (PDF)"
          bucket="products"
          folder="sketchcut"
          accept="application/pdf"
          defaultUrl={product?.sketchcut_file_url}
        />
        <FileUpload
          name="instruction_url"
          label="Yigʻish yoʻriqnomasi"
          bucket="products"
          folder="instructions"
          accept="application/pdf,image/*"
          defaultUrl={product?.instruction_url}
        />
      </section>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-lg sm:w-auto">
        {product ? 'Saqlash' : 'Mahsulot yaratish'}
      </SubmitButton>
    </form>
  );
}
