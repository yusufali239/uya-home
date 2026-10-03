import { redirect } from 'next/navigation';
import { isStaff, requireUser } from '@/lib/auth';

/** Главная: директора/менеджера — в админку, мастера — на его экран */
export default async function HomePage() {
  const profile = await requireUser();
  redirect(isStaff(profile) ? '/admin' : '/master');
}
