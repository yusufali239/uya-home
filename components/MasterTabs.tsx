'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/master', label: 'Задачи', icon: '📋', exact: true },
  { href: '/master/supplies', label: 'Мелочи', icon: '🔩' },
  { href: '/master/finance', label: 'Деньги', icon: '💰' },
  { href: '/master/account', label: 'Профиль', icon: '👤' },
];

/** Нижняя панель вкладок мастера — как в мобильном приложении */
export function MasterTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map((tab) => {
          // «Задачи» активны и внутри партии/заказа
          const active = tab.exact
            ? pathname === '/master' || pathname.startsWith('/master/batch') || pathname.startsWith('/master/order')
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${active ? 'text-brand-700' : 'text-gray-500'}`}
            >
              <span className={`text-2xl ${active ? '' : 'opacity-60 grayscale'}`}>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
