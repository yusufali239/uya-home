import type { BatchPartsGroup } from '@/lib/parts';

/** Таблица деталей партии по цветам ЛДСП */
export function BatchParts({ groups, modelsWithoutParts }: { groups: BatchPartsGroup[]; modelsWithoutParts: string[] }) {
  if (groups.length === 0 && modelsWithoutParts.length === 0) return null;

  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-xl font-bold">Detallar roʻyxati</h2>
      {groups.map((g) => (
        <div key={g.color} className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h3 className="text-lg font-semibold">LDSP: {g.color}</h3>
            <span className="text-sm text-gray-500">
              {g.pieces} dona · {g.area.toFixed(2)} m²
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-2">Detal</th>
                  <th className="py-2 pr-2">Oʻlcham, mm</th>
                  <th className="py-2 pr-2 text-right">Soni</th>
                  <th className="py-2">Kromka</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {g.lines.map((l) => (
                  <tr key={`${l.model}-${l.part.id}`}>
                    <td className="py-2 pr-2">
                      <span className="font-medium">{l.part.name}</span>
                      <span className="block text-xs text-gray-500">{l.model}{l.part.notes ? ` · ${l.part.notes}` : ''}</span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 font-mono">
                      {l.part.length_mm}×{l.part.width_mm}×{Number(l.part.thickness_mm)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 text-right">
                      <b className="text-base">{l.total}</b>
                      <span className="block text-xs text-gray-500">{l.perItem} × {l.items}</span>
                    </td>
                    <td className="py-2 text-gray-600">{l.part.edge ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {modelsWithoutParts.length > 0 && (
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Detallar kiritilmagan: {modelsWithoutParts.join(', ')}
        </p>
      )}
    </div>
  );
}
