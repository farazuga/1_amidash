import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler: true, // Temporarily disabled to debug production form hang
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.amitrace.com',
        pathname: '/wp-content/uploads/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
};

export default nextConfig;
