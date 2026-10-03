/** @type {import('next').NextConfig} */
const nextConfig = {
  // Telegraf использует нативные модули Node — не бандлим его
  experimental: {
    serverComponentsExternalPackages: ['telegraf'],
  },
  images: {
    // Фото товаров лежат в Supabase Storage
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
};

export default nextConfig;
