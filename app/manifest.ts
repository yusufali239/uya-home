import type { MetadataRoute } from 'next';

/** PWA-манифест: экран мастера ставится на телефон как приложение */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UYA HOME — Usta',
    short_name: 'UYA Usta',
    description: 'Sex vazifalari: kesish partiyalari va buyurtmalarni joʻnatish',
    start_url: '/master',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f3ee',
    theme_color: '#8a623a',
    lang: 'uz',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
