import type { MetadataRoute } from 'next';

/** Lets officers add GorillaSales to their phone's home screen; it opens on the Visits page. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GorillaSales',
    short_name: 'GorillaSales',
    description: 'Field sales: log visits and orders, even with no signal.',
    start_url: '/daily-sales-entry',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4a2c17',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
