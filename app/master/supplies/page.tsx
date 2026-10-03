import { SuppliesBoard } from '@/components/SuppliesBoard';

export const dynamic = 'force-dynamic';

export default function MasterSuppliesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Mayda materiallar</h1>
      <SuppliesBoard canDelete={false} showHistory={false} />
    </>
  );
}
