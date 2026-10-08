import { imageHosts } from './image-hosts.config.mjs';

import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// e.g. "0.1.0 (a1b2c3d)" on Vercel; shown in the app footer so support knows which build a phone runs
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: commit ? `${version} (${commit})` : version },
  distDir: process.env.DIST_DIR || '.next',
  eslint: {
    // TODO: re-enable once the codebase is Prettier-formatted (currently hundreds of formatting errors)
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
    qualities: [75, 85, 100],
  },
  async headers() {
    // The service worker must always be re-checked, or phones keep an old one for a day
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }];
  },
};
export default nextConfig;
