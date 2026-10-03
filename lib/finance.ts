import type { FinanceEntry, Profile } from '@/lib/types';

export interface PersonBalance {
  profile: Pick<Profile, 'id' | 'full_name' | 'role'>;
  income: number;   // получил (приходы)
  expense: number;  // потратил (расходы)
  given: number;    // отдал другим
  received: number; // получил от других
  /** На руках: >0 — держит деньги компании, <0 — компания должна сотруднику */
  onHands: number;
}

/**
 * Сводка по подтверждённым записям:
 *   на руках = приходы − расходы − отдал + получил
 *   деньги компании = сумма «на руках» у всех = приходы − расходы
 */
export function computeBalances(
  entries: FinanceEntry[],
  profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[],
): { people: PersonBalance[]; companyTotal: number; totalIncome: number; totalExpense: number } {
  const byId = new Map<string, PersonBalance>(
    profiles.map((p) => [p.id, { profile: p, income: 0, expense: 0, given: 0, received: 0, onHands: 0 }]),
  );
  let totalIncome = 0;
  let totalExpense = 0;

  for (const e of entries) {
    if (e.status !== 'approved') continue;
    const amount = Number(e.amount);
    const person = byId.get(e.person_id);
    if (e.kind === 'income') {
      totalIncome += amount;
      if (person) person.income += amount;
    } else if (e.kind === 'expense') {
      totalExpense += amount;
      if (person) person.expense += amount;
    } else {
      if (person) person.given += amount;
      const to = e.to_person_id ? byId.get(e.to_person_id) : undefined;
      if (to) to.received += amount;
    }
  }

  for (const p of byId.values()) p.onHands = p.income - p.expense - p.given + p.received;

  const people = [...byId.values()]
    .filter((p) => p.income || p.expense || p.given || p.received)
    .sort((a, b) => b.onHands - a.onHands);

  return { people, companyTotal: totalIncome - totalExpense, totalIncome, totalExpense };
}
