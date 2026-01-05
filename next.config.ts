import type { NextConfig } from "next";
// @ts-expect-error - next-pwa doesn't have type declarations
import withPWA from 'next-pwa';

// Security Headers Configuration
const securityHeaders = [
  {
    // Prevent clickjacking attacks by denying iframe embedding
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Prevent MIME type sniffing
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Control referrer information sent with requests
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Legacy XSS protection (still useful for older browsers)
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    // Restrict browser features and APIs
    // Note: camera and microphone enabled for file capture feature
    key: 'Permissions-Policy',
    value: [
      'camera=(self)',
      'microphone=(self)',
      'geolocation=()',
      'browsing-topics=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', '),
  },
  {
    // HTTP Strict Transport Security - enforce HTTPS
    // Only applied in production via the headers function below
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    // Content Security Policy
    // Note: 'unsafe-inline' is required for Tailwind CSS and Next.js inline styles
    // In production, consider using nonce-based CSP via middleware for stricter security
    key: 'Content-Security-Policy',
    value: [
      // Default: deny all
      "default-src 'self'",
      // Scripts: self + inline (required for Next.js)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (required for Tailwind CSS)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + data URIs + allowed domains (including SharePoint thumbnails)
      "img-src 'self' data: blob: https://www.amitrace.com https://*.supabase.co https://*.sharepoint.com https://*.svc.ms",
      // Media: blob URLs for video/audio preview from camera capture
      "media-src 'self' blob:",
      // Fonts: self + data URIs
      "font-src 'self' data:",
      // Connect: API endpoints - Supabase and Microsoft OAuth/Graph
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://login.microsoftonline.com https://graph.microsoft.com https://*.sharepoint.com",
      // Frame ancestors: prevent embedding (same as X-Frame-Options)
      "frame-ancestors 'none'",
      // Form actions: only allow forms to submit to self
      "form-action 'self'",
      // Base URI: restrict base tag
      "base-uri 'self'",
      // Object sources: disable plugins
      "object-src 'none'",
      // Upgrade insecure requests in production
      "upgrade-insecure-requests",
      // Block mixed content
      "block-all-mixed-content",
    ].join('; '),
  },
];

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
    // Increase body size limit for video uploads via Server Actions
    // 720p video at ~2.5 Mbps = ~18 MB/min, so 100 MB covers ~5 min videos
    serverActions: {
      bodySizeLimit: '100MB',  // Note: uppercase MB works more reliably
    },
  },
  // Empty turbopack config to satisfy the PWA webpack compatibility check
  turbopack: {},

  // Security headers configuration
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: process.env.NODE_ENV === 'production'
          ? securityHeaders
          : securityHeaders.filter(
              // Skip HSTS in development (no HTTPS)
              (header) => header.key !== 'Strict-Transport-Security'
            ),
      },
    ];
  },
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
