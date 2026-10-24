import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Activates built-in cacheLife profiles (default, max, etc.) so that
  // revalidateTag(tag, 'default') can resolve the profile at runtime.
  // Without this, workStore.cacheLifeProfiles is undefined and revalidateTag throws,
  // silently failing to invalidate the cache.
  cacheLife: {},
  // Демо-сайт только для чтения (lib/demo/read-only.ts): браузерному клиенту Supabase признак
  // нужен на этапе сборки. У прода DEMO_MODE не задан — значение пустое.
  env: {
    TASKHUB_DEMO_READ_ONLY: process.env.DEMO_MODE === '1' && process.env.DEMO_WRITABLE !== '1' ? '1' : '',
  },
  experimental: {
    serverActions: {
      // Default body limit is 1MB — raises it to allow file uploads up to 25MB.
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
