import type { NextConfig } from "next";
// @ts-expect-error - next-pwa doesn't have type declarations
import withPWA from 'next-pwa';

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
  // Empty turbopack config to satisfy the PWA webpack compatibility check
  turbopack: {},
};

// PWA configuration for offline file capture
const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Fallback to webpack for PWA service worker generation
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      // Cache API responses (not file uploads)
      urlPattern: /^https:\/\/.*\/api\/((?!sharepoint|files).*)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
    {
      // Cache static assets
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
        },
      },
    },
    {
      // Cache fonts
      urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'font-cache',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 1 month
        },
      },
    },
    {
      // Cache CSS and JS
      urlPattern: /\.(?:js|css)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
  ],
});

export default pwaConfig(nextConfig);
