import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Lint runs in dev (and via `pnpm lint`). Production builds don't fail on lint.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Same idea: type errors surface in `pnpm type-check` and the IDE, not in
    // production builds. Useful when the build environment has slightly older
    // type definitions than local dev.
    ignoreBuildErrors: true,
  },
  typedRoutes: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.googleusercontent.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
