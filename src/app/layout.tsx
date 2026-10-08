import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4a2c17',
};

export const metadata: Metadata = {
  title: 'GorillaSales — Coffee Field Sales CRM',
  description:
    'GorillaSales helps coffee distribution teams log daily visits, track pipeline deals, and monitor rep performance against monthly targets.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: 'GorillaSales', statusBarStyle: 'default' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}