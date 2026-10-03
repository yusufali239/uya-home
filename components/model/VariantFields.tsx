import { FileUpload } from '@/components/FileUpload';
import type { ProductWithStock } from '@/lib/types';

/** Поля цвета: цвет, артикул, остаток, минимум, место, фото */
export function VariantFields({ variant, idPrefix = 'v' }: { variant?: ProductWithStock; idPrefix?: string }) {
  const quantity = variant?.inventory_finished?.quantity ?? 0;
  const location = variant?.inventory_finished?.location ?? '';
  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label" htmlFor={id('color')}>Rangi *</label>
          <input id={id('color')} name="color" required placeholder="Oq" defaultValue={variant?.color ?? ''} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={id('sku')}>Artikul (SKU) *</label>
          <input id={id('sku')} name="sku" required placeholder="002AO" defaultValue={variant?.sku} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={id('quantity')}>{variant ? 'Omborda' : 'Boshlangʻich qoldiq'}</label>
          <input id={id('quantity')} name="quantity" type="number" min={0} defaultValue={quantity} className="input" />
          <input type="hidden" name="original_quantity" value={quantity} />
        </div>
        <div>
          <label className="label" htmlFor={id('min_quantity')}>Minimal qoldiq *</label>
          <input
            id={id('min_quantity')}
            name="min_quantity"
            type="number"
            min={0}
            required
            defaultValue={variant?.min_quantity ?? 5}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={id('location')}>Saqlash joyi</label>
          <input id={id('location')} name="location" placeholder="A1 javon" defaultValue={location} className="input" />
          <input type="hidden" name="original_location" value={location} />
        </div>
      </div>
      <FileUpload
        name="brand_photo_url"
        label="Shu rangdagi rasm (yorliq uchun)"
        bucket="products"
        folder="photos"
        accept="image/*"
        defaultUrl={variant?.brand_photo_url}
      />
    </>
  );
}
