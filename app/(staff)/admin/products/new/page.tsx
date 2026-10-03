import type { Metadata } from 'next';
import Link from 'next/link';
import { createProduct } from '@/app/actions/products';
import { ProductForm } from '@/components/ProductForm';

export const metadata: Metadata = { title: 'Новый товар' };

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Склад</Link>
      <h1 className="text-2xl font-bold">Новый товар</h1>
      <ProductForm action={createProduct} />
    </div>
  );
}
