import type { Metadata } from 'next';
import { RemnantsBoard } from '@/components/RemnantsBoard';

export const metadata: Metadata = { title: 'LDSP qoldiqlari' };
export const dynamic = 'force-dynamic';

export default function RemnantsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">LDSP qoldiqlari</h1>
      <p className="text-sm text-gray-500">Qoldiqlarni ustalar yuritadi: kesishdan keyin qoʻshadi, ishlatganda hisobdan chiqaradi.</p>
      <RemnantsBoard />
    </div>
  );
}
