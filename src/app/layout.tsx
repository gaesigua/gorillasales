import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import '../styles/tailwind.css';
import { ConfigProvider } from '@/context/ConfigContext';
import { UserProvider } from '@/context/UserContext';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
  variable: '--font-roboto',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'GorillaSales — Coffee Field Sales CRM',
  description:
    'GorillaSales helps coffee distribution teams log daily visits, track pipeline deals, and monitor rep performance against monthly targets.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <ConfigProvider>
          <UserProvider>
            {children}
          </UserProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}