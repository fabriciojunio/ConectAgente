import type { Metadata } from 'next';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={dmSans.variable} suppressHydrationWarning>
      <body className={dmSans.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
