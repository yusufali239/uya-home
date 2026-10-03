import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Вход' };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="text-3xl font-black tracking-tight text-brand-700">UYA HOME</div>
          <p className="mt-1 text-sm text-gray-500">Склад · Заказы · Раскрой</p>
        </div>
        <LoginForm next={searchParams.next ?? ''} />
      </div>
    </main>
  );
}
