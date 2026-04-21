import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@beagle-console/db', '@beagle-console/shared'],
};

export default nextConfig;
