import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Pastas de saída separadas para desenvolvimento e produção.
   *
   * Sem isto, `next build` e `next dev` gravam na mesma `.next` e o servidor de
   * desenvolvimento passa a ler o manifesto de rotas do build de produção. O sintoma é
   * cruel: a página inicial abre normalmente e **todas as outras rotas devolvem 404**, sem
   * nenhum erro no terminal que aponte a causa.
   *
   * Não é hipótese — aconteceu aqui, e a sequência que provoca está no próprio README:
   * `pnpm build` (necessário antes das migrations) seguido de `pnpm dev`.
   */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

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
