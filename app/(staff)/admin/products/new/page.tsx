import type { Metadata } from 'next';
import Link from 'next/link';
import { createProduct } from '@/app/actions/products';
import { ProductForm } from '@/components/ProductForm';

export const metadata: Metadata = { title: 'Yangi mahsulot' };

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Ombor</Link>
      <h1 className="text-2xl font-bold">Yangi mahsulot</h1>
      <ProductForm action={createProduct} />
    </div>
  );
}
