import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Activates built-in cacheLife profiles (default, max, etc.) so that
  // revalidateTag(tag, 'default') can resolve the profile at runtime.
  // Without this, workStore.cacheLifeProfiles is undefined and revalidateTag throws,
  // silently failing to invalidate the cache.
  cacheLife: {},
};

export default nextConfig;
