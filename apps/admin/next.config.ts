import type { NextConfig } from 'next';

/**
 * Painel administrativo: todas as páginas são privadas e dinâmicas (sessão por cookie),
 * por isso Cache Components fica desligado.
 */
const nextConfig: NextConfig = {
  transpilePackages: ['@app/shared'],
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
