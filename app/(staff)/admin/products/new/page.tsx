import type { Metadata } from 'next';
import Link from 'next/link';
import { NewModelForm } from '@/components/model/NewModelForm';

export const metadata: Metadata = { title: 'Yangi mahsulot' };

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Ombor</Link>
      <h1 className="text-2xl font-bold">Yangi mahsulot</h1>
      <NewModelForm />
    </div>
  );
}
