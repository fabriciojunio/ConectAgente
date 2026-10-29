import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

// A politica de seguranca de conteudo saiu daqui e mora no middleware, em
// `montarCsp`. O motivo e o nonce: ele precisa ser sorteado por requisicao, e
// cabecalho declarado aqui e estatico. Com nonce, so executa o script que
// carrega o valor daquela resposta, e `'unsafe-inline'` pode sair de
// producao. Os demais cabecalhos continuam aqui, porque nao dependem da
// requisicao.

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  // Evita que o Next.js infira a raiz errada quando há lockfiles
  // em diretórios acima do projeto
  outputFileTracingRoot: __dirname,

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        },
        // Isola a página de outras origens. `credentialless` em vez de
        // `require-corp` porque as imagens do Supabase não mandam CORP.
        { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        // Sistema interno com dados de saúde: não deve ser indexado
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ],
};

export default nextConfig;
