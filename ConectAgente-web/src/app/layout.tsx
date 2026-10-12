import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ),
  title: {
    default: 'ConectAgente - Gestão',
    template: '%s | ConectAgente',
  },
  description:
    'Plataforma de gestão e monitoramento para Agentes Comunitários de Saúde (ACS)',
  // Sistema interno com dados de saúde: fora dos índices de busca
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'ConectAgente',
    description:
      'Plataforma de gestão e monitoramento para Agentes Comunitários de Saúde (ACS)',
    siteName: 'ConectAgente',
    locale: 'pt_BR',
    type: 'website',
    images: ['/logo.png'],
  },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

/**
 * Decide o tema no servidor, pelo cookie.
 *
 * Fazer isso aqui, e nao num script embutido no <head>, mantem a politica de
 * seguranca fechada: script embutido exigiria `'unsafe-inline'` em
 * `script-src`, que e a brecha que torna um XSS exploravel. O custo e so ler
 * um cookie.
 *
 * Em 'sistema' o servidor nao tem como saber a preferencia do aparelho, entao
 * renderiza claro e o cliente corrige no primeiro efeito. Quem escolheu
 * escuro de forma fixa nao ve nenhum piscar, que e o caso que incomoda.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const modo = (await cookies()).get('conectagente_tema')?.value;
  const escuro = modo === 'escuro';

  return (
    <html
      lang="pt-BR"
      className={`${dmSans.variable}${escuro ? ' dark' : ''}`}
      suppressHydrationWarning
    >
      <body className={dmSans.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
