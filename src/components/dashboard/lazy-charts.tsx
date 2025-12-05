'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/skeletons';

// Lazy load StatusChart - only loads when needed
export const LazyStatusChart = dynamic(
  () => import('./status-chart').then((mod) => ({ default: mod.StatusChart })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

// Lazy load RevenueChart - only loads when needed
export const LazyRevenueChart = dynamic(
  () => import('./revenue-chart').then((mod) => ({ default: mod.RevenueChart })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);
