import type { Metadata } from 'next';
import { SuppliesBoard } from '@/components/SuppliesBoard';

export const metadata: Metadata = { title: 'Mayda materiallar' };
export const dynamic = 'force-dynamic';

export default function AdminSuppliesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Mayda materiallar</h1>
      <p className="text-sm text-gray-500">Yevrovint, shkant, kromka, yelim… Usta yuritadi, bu yerda qoldiq va jurnal koʻrinadi.</p>
      <SuppliesBoard canDelete showHistory />
    </div>
  );
}
