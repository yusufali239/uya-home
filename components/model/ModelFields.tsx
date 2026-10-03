import { FileUpload } from '@/components/FileUpload';
import type { ProductModel } from '@/lib/types';

/** Общие поля модели: название, размеры, цены, фото и файлы */
export function ModelFields({ model }: { model?: ProductModel }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Model nomi *</label>
          <input id="name" name="name" required placeholder="Zedd" defaultValue={model?.name} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="dimensions">Oʻlchamlari</label>
          <input id="dimensions" name="dimensions" placeholder="550×600×250" defaultValue={model?.dimensions ?? ''} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="price">Sotish narxi, som</label>
          <input id="price" name="price" inputMode="decimal" defaultValue={model?.price ?? ''} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="cost_price">Tannarxi, som</label>
          <input id="cost_price" name="cost_price" inputMode="decimal" defaultValue={model?.cost_price ?? ''} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Izoh</label>
          <textarea id="description" name="description" rows={2} defaultValue={model?.description ?? ''} className="input" />
        </div>
      </div>
      <FileUpload
        name="photo_url"
        label="Model rasmi (rangning oʻz rasmi boʻlmasa ishlatiladi)"
        bucket="products"
        folder="photos"
        accept="image/*"
        defaultUrl={model?.photo_url}
      />
      <FileUpload
        name="sketchcut_file_url"
        label="SketchCut kesish chizmasi (PDF)"
        bucket="products"
        folder="sketchcut"
        accept="application/pdf"
        defaultUrl={model?.sketchcut_file_url}
      />
      <FileUpload
        name="instruction_url"
        label="Yigʻish yoʻriqnomasi"
        bucket="products"
        folder="instructions"
        accept="application/pdf,image/*"
        defaultUrl={model?.instruction_url}
      />
    </>
  );
}
