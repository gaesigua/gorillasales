/** Gorilla's Coffee contact details, shown in the public footer, help page and on printed documents. */
export const COMPANY = {
  name: "Gorilla's Coffee",
  tagline: 'Beyond Fair Trade',
  addressLines: ['KK 530 St, NAEB-HQ, Gikondo – Magerwa', 'P.O. Box 402, Kigali, Rwanda'],
  phone: '+250 782 972 168',
  email: 'info@gorillascoffee.com',
  website: 'https://gorillascoffee.com',
} as const;

/** Certifications first (they vouch for the product), then partners. Logos used with permission. */
export const PARTNERS: { file: string; name: string }[] = [
  { file: 'partner-rsb-iso-9001.png', name: 'Rwanda Standards Board — ISO 9001 certified' },
  { file: 'partner-organica.png', name: 'Organica' },
  { file: 'partner-minagri.png', name: 'Ministry of Agriculture and Animal Resources' },
  { file: 'partner-rdb.png', name: 'Rwanda Development Board' },
  { file: 'partner-brd.png', name: 'Development Bank of Rwanda (BRD)' },
  { file: 'partner-psf.png', name: 'Private Sector Federation' },
  { file: 'partner-giz.png', name: 'GIZ' },
  { file: 'partner-un.png', name: 'United Nations' },
];

/** Shown in the app footer so support can tell which build a phone is running. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
