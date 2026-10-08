import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111111',
};

export const metadata: Metadata = {
  // Page name first, so it stays readable when browser tabs are narrow: "Orders · GorillaSales"
  title: { default: "GorillaSales · Gorilla's Coffee", template: '%s · GorillaSales' },
  description:
    "Gorilla's Coffee staff system for sales visits, orders, deliveries, stock and receivables.",
  // A staff tool: keep it out of search results (customers should find gorillascoffee.com)
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
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