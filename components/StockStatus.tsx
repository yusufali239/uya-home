/** Индикатор остатка: зелёный — хватает, красный — ниже минимума */
export function StockStatus({ quantity, min }: { quantity: number; min: number }) {
  const ok = quantity >= min;
  return (
    <span className={`badge gap-1.5 ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {ok ? 'Yetarli' : 'Kam'}
    </span>
  );
}
