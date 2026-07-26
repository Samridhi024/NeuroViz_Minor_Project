import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@samruddhi-agros/api-client',
    '@samruddhi-agros/shared-types',
  ],
};

export default nextConfig;
