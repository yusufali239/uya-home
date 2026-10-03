import type { Metadata } from 'next';
import { SuppliesBoard } from '@/components/SuppliesBoard';

export const metadata: Metadata = { title: 'Мелочи склада' };
export const dynamic = 'force-dynamic';

export default function AdminSuppliesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Мелочи склада</h1>
      <p className="text-sm text-gray-500">Евровинты, шканты, кромка, клей… Ведёт мастер, здесь видно остатки и журнал.</p>
      <SuppliesBoard canDelete showHistory />
    </div>
  );
}
