'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Склад', exact: true },
  { href: '/admin/orders', label: 'Заказы' },
  { href: '/batches', label: 'Партии' },
  { href: '/admin/supplies', label: 'Мелочи' },
  { href: '/admin/finance', label: 'Бухгалтерия' },
  { href: '/admin/remnants', label: 'Обрезки' },
  { href: '/master', label: 'Экран мастера' },
];

/** Верхнее меню админки с подсветкой текущего раздела */
export function StaffNav({ isDirector }: { isDirector: boolean }) {
  const pathname = usePathname();
  const links = [
    ...LINKS,
    ...(isDirector ? [{ href: '/admin/users', label: 'Сотрудники' }] : []),
    { href: '/admin/account', label: 'Профиль' },
  ];

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto text-sm font-medium">
      {links.map((link) => {
        const active = 'exact' in link && link.exact
          ? pathname === link.href || pathname.startsWith('/admin/products')
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${
              active ? 'bg-brand-100 text-brand-900' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
