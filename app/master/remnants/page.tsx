import { RemnantsBoard } from '@/components/RemnantsBoard';

export const dynamic = 'force-dynamic';

/** Обрезки ЛДСП — вкладка мастера */
export default function MasterRemnantsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">LDSP qoldiqlari</h1>
      <RemnantsBoard />
    </>
  );
}
