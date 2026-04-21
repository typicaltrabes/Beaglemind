import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@beagle-console/db', '@beagle-console/shared'],
};

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
});

export default withSerwist(nextConfig);
