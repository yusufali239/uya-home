import type { MetadataRoute } from 'next';

/** PWA-манифест: экран мастера ставится на телефон как приложение */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UYA HOME — Мастер',
    short_name: 'UYA Мастер',
    description: 'Задачи цеха: партии раскроя и отгрузка заказов',
    start_url: '/master',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f3ee',
    theme_color: '#8a623a',
    lang: 'ru',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
