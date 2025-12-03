import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.amitrace.com',
        pathname: '/wp-content/uploads/**',
      },
    ],
  },
};

export default nextConfig;
