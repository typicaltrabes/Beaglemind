import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@beagle-console/db', '@beagle-console/shared'],
};

// PWA/Serwist disabled for now — service worker intercepts API requests
// Re-enable after core sprint flow is working
// import withSerwistInit from '@serwist/next';
// const withSerwist = withSerwistInit({ swSrc: 'app/sw.ts', swDest: 'public/sw.js' });
// export default withSerwist(nextConfig);

export default nextConfig;
