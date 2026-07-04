import type { MetadataRoute } from 'next';

/**
 * O portal é um sistema interno de gestão com dados sensíveis de saúde.
 * Nenhuma página deve ser indexada por buscadores nem usada para
 * treinamento de modelos de IA.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'ChatGPT-User', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'ClaudeBot', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
      { userAgent: 'Applebot-Extended', disallow: '/' },
      { userAgent: 'PerplexityBot', disallow: '/' },
      { userAgent: 'Bytespider', disallow: '/' },
      { userAgent: 'meta-externalagent', disallow: '/' },
      { userAgent: '*', disallow: '/' },
    ],
  };
}
