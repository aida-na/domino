import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        // Static public/ fallback + any residual static responses
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
  async rewrites() {
    const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const apiBase = raw.replace(/\/api\/v1\/?$/, '') || 'http://localhost:8000';

    return [
      { source: '/api/v1/:path*', destination: `${apiBase}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
