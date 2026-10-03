import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: { default: 'UYA HOME', template: '%s · UYA HOME' },
  description: 'Склад готовой мебели, заказы и партии раскроя ЛДСП',
  applicationName: 'UYA HOME',
  appleWebApp: { capable: true, title: 'UYA Мастер', statusBarStyle: 'default' },
  icons: { icon: '/icons/192', apple: '/icons/192' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8a623a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
