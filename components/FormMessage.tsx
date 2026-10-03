import type { ActionState } from '@/lib/types';

/** Сообщение об ошибке/успехе под формой */
export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.error}</p>;
  }
  if (state.message) {
    return <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{state.message}</p>;
  }
  return null;
}
