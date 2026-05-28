import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'ConectAgente - Gestão',
  description:
    'Plataforma de gestão e monitoramento para Agentes Comunitários de Saúde (ACS)',
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
