import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O pacote de tipos compartilhados vive no monorepo e é compilado junto.
  transpilePackages: ['@gestao/types'],
  // Cabeçalhos mínimos de segurança. A revisão completa é da Fase 2, com o Security.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
